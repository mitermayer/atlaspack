class MyClass {
  static prop = 'value';

  method() {
    return this.prop?.length;
  }
}

export default new MyClass();
