import {foo} from './module.js';

console.log('init', foo);

if (module.hot) {
  module.hot.accept();
}
