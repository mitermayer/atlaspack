use anyhow::{Result, anyhow};
use mozjpeg_sys::*;
use oxipng::{Options, StripChunks, optimize_from_memory};
use std::mem;
use std::os::raw::{c_int, c_ulong, c_void};
use std::ptr;
use std::slice;

pub fn optimize(kind: &str, buf: &[u8]) -> Result<Vec<u8>> {
  match kind {
    "png" => {
      let options = Options {
        strip: StripChunks::Safe,
        ..Default::default()
      };
      optimize_from_memory(buf, &options).map_err(|e| anyhow!("{}", e))
    }
    "jpg" | "jpeg" => unsafe { optimize_jpeg(buf) },
    _ => Err(anyhow!("Unknown image type {}", kind)),
  }
}

struct JPEGOptimizer {
  srcinfo: jpeg_decompress_struct,
  dstinfo: jpeg_compress_struct,
}

impl JPEGOptimizer {
  unsafe fn new() -> JPEGOptimizer {
    JPEGOptimizer {
      srcinfo: unsafe { mem::zeroed() },
      dstinfo: unsafe { mem::zeroed() },
    }
  }
}

impl Drop for JPEGOptimizer {
  fn drop(&mut self) {
    unsafe {
      jpeg_destroy_decompress(&mut self.srcinfo);
      jpeg_destroy_compress(&mut self.dstinfo);
    }
  }
}

// This function losslessly optimizes jpegs.
// Based on the jpegtran.c example program in libjpeg.
#[allow(clippy::mut_from_ref)]
unsafe fn optimize_jpeg(bytes: &[u8]) -> Result<Vec<u8>> {
  std::panic::catch_unwind(|| unsafe {
    let mut info = JPEGOptimizer::new();
    let mut err = create_error_handler();
    info.srcinfo.common.err = &mut err;
    jpeg_create_decompress(&mut info.srcinfo);
    jpeg_mem_src(&mut info.srcinfo, bytes.as_ptr(), bytes.len() as c_ulong);

    info.dstinfo.optimize_coding = 1;
    info.dstinfo.common.err = &mut err;
    jpeg_create_compress(&mut info.dstinfo);
    jpeg_read_header(&mut info.srcinfo, 1);

    let src_coef_arrays = jpeg_read_coefficients(&mut info.srcinfo);
    jpeg_copy_critical_parameters(&info.srcinfo, &mut info.dstinfo);

    let mut buf = ptr::null_mut();
    let mut outsize: c_ulong = 0;
    jpeg_mem_dest(&mut info.dstinfo, &mut buf, &mut outsize);

    jpeg_write_coefficients(&mut info.dstinfo, src_coef_arrays);

    jpeg_finish_compress(&mut info.dstinfo);
    jpeg_finish_decompress(&mut info.srcinfo);

    let slice = slice::from_raw_parts_mut(buf, outsize as usize);
    let vec = slice.to_vec();
    libc::free(buf as *mut c_void);
    vec
  })
  .map_err(|e| {
    if let Some(msg) = e.downcast_ref::<String>() {
      anyhow!("{}", msg)
    } else {
      anyhow!("Unknown libjpeg error")
    }
  })
}

unsafe fn create_error_handler() -> jpeg_error_mgr {
  let mut err: jpeg_error_mgr = unsafe { mem::zeroed() };
  unsafe { jpeg_std_error(&mut err) };
  err.error_exit = Some(unwind_error_exit);
  err.emit_message = Some(silence_message);
  err
}

unsafe extern "C-unwind" fn unwind_error_exit(cinfo: &mut jpeg_common_struct) {
  let message = unsafe {
    let err = cinfo.err.as_ref().unwrap();
    match err.format_message {
      Some(fmt) => {
        let buffer = mem::zeroed();
        fmt(cinfo, &buffer);
        let len = buffer.iter().take_while(|&&c| c != 0).count();
        String::from_utf8_lossy(&buffer[..len]).into()
      }
      None => format!("libjpeg error: {}", err.msg_code),
    }
  };
  std::panic::resume_unwind(Box::new(message))
}

unsafe extern "C-unwind" fn silence_message(_cinfo: &mut jpeg_common_struct, _level: c_int) {}
