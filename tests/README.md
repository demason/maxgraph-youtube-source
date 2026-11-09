# Production-behavior tests

From the repository root, with Node.js 18 or newer:

```sh
npm ci --prefix tests
npm test --prefix tests
```

This repository contains standalone tutorial examples rather than one application.
The initial suite targets `UI-компоненты №6. Корзина товаров на чистом js - localStorage`,
where monetary totals, saved customer selections, and the outgoing order payload
are higher-risk than visual interactions.

The tests load the example's actual HTML and execute its unmodified `js/cart.js`
in JSDOM. They cover formatted-price arithmetic, duplicate-add prevention,
removal/re-addition, storage restoration across fresh documents, deletion through
the order modal, and checkout fields sent to `mail.php`.

SimpleBar's content wrapper is supplied by the harness. GraphModal's open callback
is invoked directly, and XMLHttpRequest is captured without sending network
requests. These tests do not verify layout, the modal library, or PHP/email delivery.
Dependencies are isolated here so the examples' build configurations are unchanged.
