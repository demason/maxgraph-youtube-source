const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const example = path.join(__dirname, '..', 'UI-компоненты №6. Корзина товаров на чистом js - localStorage');
const html = readFileSync(path.join(example, 'index.html'), 'utf8');
const script = readFileSync(path.join(example, 'js/cart.js'), 'utf8');

async function loadCart(t, savedProducts) {
  const dom = new JSDOM(html, {
    url: 'https://shop.example/',
    runScripts: 'outside-only',
    virtualConsole: new VirtualConsole(),
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  // Let JSDOM finish its own DOMContentLoaded before registering the app listener.
  await new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
  const document = window.document;
  const errors = [];
  window.addEventListener('error', event => errors.push(event.error));
  t.after(() => assert.deepEqual(errors, [], 'no uncaught application errors'));

  // SimpleBar owns this wrapper in the browser; layout is outside these tests.
  const content = document.createElement('div');
  content.className = 'simplebar-content';
  document.querySelector('.cart-content__list').append(content);
  let modal;
  window.GraphModal = class {
    constructor(callbacks) { modal = callbacks; }
  };
  const requests = [];
  window.XMLHttpRequest = class {
    open(method, url, async) { Object.assign(this, { method, url, async }); }
    send(body) { requests.push({ method: this.method, url: this.url, async: this.async, body }); }
  };
  if (savedProducts !== undefined) window.localStorage.setItem('products', savedProducts);
  window.eval(script);
  document.dispatchEvent(new window.Event('DOMContentLoaded'));

  return {
    window, document, requests,
    buttons: [...document.querySelectorAll('.product__btn')],
    items: () => [...content.querySelectorAll('.cart-content__product')],
    total: () => document.querySelector('.fullprice').textContent,
    quantity: () => document.querySelector('.cart__quantity').textContent,
    saved: () => window.localStorage.getItem('products'),
    openOrder: () => modal.isOpen(),
  };
}

test('adding products sums formatted ruble prices, disables duplicates and persists both items', async t => {
  const cart = await loadCart(t);
  cart.document.querySelectorAll('.product-price__current')[0].textContent = '1\u00a0234 ₽';
  cart.document.querySelectorAll('.product-price__current')[1].textContent = '12 345 ₽';
  cart.buttons[0].click();
  cart.buttons[0].click();
  cart.buttons[1].click();

  assert.equal(cart.total(), '13 579 ₽');
  assert.equal(cart.quantity(), '2');
  assert.equal(cart.items().length, 2);
  assert.equal(cart.document.querySelector('.cart').classList.contains('active'), true);
  assert.equal(cart.buttons[0].disabled, true);
  assert.equal(cart.buttons[1].disabled, true);
  const restored = await loadCart(t, cart.saved());
  assert.equal(restored.total(), '13 579 ₽');
  assert.equal(restored.items().length, 2);
});

test('removing the last cart item resets the total, removes storage and allows re-adding', async t => {
  const cart = await loadCart(t);
  cart.buttons[0].click();
  cart.document.querySelector('.cart-product__delete').click();

  assert.equal(cart.items().length, 0);
  assert.equal(cart.quantity(), '0');
  assert.equal(cart.total(), '0 ₽');
  assert.equal(cart.document.querySelector('.cart').classList.contains('active'), false);
  assert.equal(cart.buttons[0].disabled, false);
  assert.equal(cart.saved(), null);
  cart.buttons[0].click();
  assert.equal(cart.items().length, 1);
  assert.notEqual(cart.saved(), null);
});

test('restoring a saved cart recovers totals and disabled buttons, then persists a removal', async t => {
  const original = await loadCart(t);
  original.buttons[0].click();
  original.buttons[1].click();
  const restored = await loadCart(t, original.saved());

  assert.equal(restored.total(), original.total());
  assert.equal(restored.quantity(), '2');
  assert.equal(restored.buttons[0].disabled, true);
  assert.equal(restored.buttons[1].disabled, true);
  assert.equal(restored.document.querySelector('.cart').classList.contains('active'), true);
  restored.document.querySelector('[data-id="0"] .cart-product__delete').click();
  assert.equal(restored.buttons[0].disabled, false);
  assert.equal(restored.buttons[1].disabled, true);
  const reloaded = await loadCart(t, restored.saved());
  assert.equal(reloaded.quantity(), '1');
  assert.equal(reloaded.total(), '190 789 ₽');
  assert.equal(reloaded.items()[0].dataset.id, '1');
});

test('removing an item through the order modal also updates the cart and saved selection', async t => {
  const cart = await loadCart(t);
  cart.buttons[0].click();
  cart.buttons[1].click();
  cart.openOrder();
  cart.document.querySelector('.order-modal__product[data-id="0"] .order-product__delete').click();

  assert.equal(cart.document.querySelectorAll('.order-modal__product').length, 1);
  assert.equal(cart.items().length, 1);
  assert.equal(cart.items()[0].dataset.id, '1');
  assert.equal(cart.total(), '190 789 ₽');
  assert.equal(cart.quantity(), '1');
  assert.equal(cart.buttons[0].disabled, false);
  const restored = await loadCart(t, cart.saved());
  assert.equal(restored.items()[0].dataset.id, '1');
  assert.equal(restored.items().length, 1);
});

test('checkout displays the selected products and POSTs their titles, prices and customer fields', async t => {
  const cart = await loadCart(t);
  const titles = cart.document.querySelectorAll('.product__title');
  titles[0].textContent = 'Laptop';
  titles[1].textContent = 'Monitor';
  cart.document.querySelectorAll('.product-price__current')[1].textContent = '12 345 ₽';
  cart.buttons[0].click();
  cart.buttons[1].click();
  cart.openOrder();
  assert.equal(cart.document.querySelector('.order-modal__quantity span').textContent, '2 шт');
  assert.equal(cart.document.querySelector('.order-modal__summ span').textContent, '203 134 ₽');
  assert.equal(cart.document.querySelectorAll('.order-modal__product').length, 2);

  const form = cart.document.querySelector('.order');
  const fields = { 'Имя': 'Test Customer', 'Телефон': '+70000000000', Email: 'customer@example.test' };
  for (const [name, value] of Object.entries(fields)) form.elements.namedItem(name).value = value;
  const event = new cart.window.Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(event);

  assert.equal(event.defaultPrevented, true);
  assert.equal(cart.requests.length, 1);
  const request = cart.requests[0];
  assert.equal(request.method, 'POST');
  assert.equal(request.url, 'mail.php');
  assert.equal(request.async, true);
  assert.deepEqual(JSON.parse(request.body.get('Товары')), [
    { title: 'Monitor', price: '12345₽' },
    { title: 'Laptop', price: '190789₽' },
  ]);
  for (const [name, value] of Object.entries(fields)) assert.equal(request.body.get(name), value);
});
