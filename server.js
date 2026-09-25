const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'ChangeMe123!';
const PAYMENT_NUMBER = '01518990050';

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const UPLOADS = path.join(ROOT, 'uploads');

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

const dbFile = path.join(DATA, 'db.json');

if (!fs.existsSync(dbFile)) {
  fs.writeFileSync(
    dbFile,
    JSON.stringify({ products: [], orders: [] }, null, 2)
  );
}

function db() {
  return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}

function save(x) {
  fs.writeFileSync(dbFile, JSON.stringify(x, null, 2));
}

function admin(req, res, next) {
  if (req.cookies.ng_admin === '1') return next();
  res.status(401).json({ error: 'Unauthorized' });
}

const storage = multer.diskStorage({
  destination: UPLOADS,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(
      null,
      Date.now() + '-' + Math.random().toString(36).slice(2) + ext
    );
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* Uploaded PDF/file access */
app.use('/uploads', express.static(UPLOADS));

/* Website files are in the repository root */
app.use(express.static(ROOT));

/* Homepage */
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

/* Admin page */
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(ROOT, 'admin.html'));
});

/* =========================
   PUBLIC API
========================= */

app.get('/api/products', (req, res) => {
  const d = db();
  res.json(d.products.filter(p => p.published));
});

app.get('/api/products/:id', (req, res) => {
  const p = db().products.find(
    x => x.id === req.params.id && x.published
  );

  if (!p) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(p);
});

/* =========================
   ORDERS / PAYMENT
========================= */

app.post('/api/orders', (req, res) => {
  const {
    productId,
    name,
    phone,
    transactionId,
    paymentMethod
  } = req.body;

  const d = db();

  const p = d.products.find(
    x => x.id === productId && x.published
  );

  if (!p) {
    return res.status(400).json({
      error: 'Product not found'
    });
  }

  if (!name || !phone || !transactionId || !paymentMethod) {
    return res.status(400).json({
      error: 'Please complete all fields'
    });
  }

  const order = {
    id: 'NG' + Date.now(),
    productId: p.id,
    productTitle: p.title,
    price: p.price,
    name,
    phone,
    transactionId,
    paymentMethod,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  d.orders.push(order);
  save(d);

  res.json({
    ok: true,
    orderId: order.id
  });
});

/* =========================
   DOWNLOAD
========================= */

app.get('/api/download/:id', (req, res) => {
  const d = db();

  const o = d.orders.find(
    x => x.id === req.params.id && x.status === 'approved'
  );

  if (!o) {
    return res
      .status(403)
      .send('Download is not available.');
  }

  const p = d.products.find(x => x.id === o.productId);

  if (
    !p ||
    !fs.existsSync(path.join(UPLOADS, p.filename))
  ) {
    return res.status(404).send('File unavailable.');
  }

  res.download(
    path.join(UPLOADS, p.filename),
    p.originalName
  );
});

/* =========================
   ADMIN LOGIN
========================= */

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (
    username === ADMIN_USER &&
    password === ADMIN_PASS
  ) {
    res.cookie('ng_admin', '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: true
    });

    return res.json({ ok: true });
  }

  res.status(401).json({
    error: 'Invalid credentials'
  });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('ng_admin');
  res.json({ ok: true });
});

/* =========================
   ADMIN ORDERS
========================= */

app.get('/api/admin/orders', admin, (req, res) => {
  res.json(db().orders);
});

app.post(
  '/api/admin/orders/:id/status',
  admin,
  (req, res) => {
    const d = db();

    const o = d.orders.find(
      x => x.id === req.params.id
    );

    if (!o) {
      return res.status(404).json({
        error: 'Not found'
      });
    }

    o.status =
      req.body.status === 'approved'
        ? 'approved'
        : 'rejected';

    save(d);

    res.json(o);
  }
);

/* =========================
   ADMIN PRODUCTS
========================= */

app.get('/api/admin/products', admin, (req, res) => {
  res.json(db().products);
});

app.post(
  '/api/admin/products',
  admin,
  upload.single('file'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'File required'
      });
    }

    const d = db();

    const p = {
      id: 'p' + Date.now(),
      title: req.body.title,
      category: req.body.category || 'Other',
      description: req.body.description || '',
      price: Number(req.body.price || 0),
      filename: req.file.filename,
      originalName: req.file.originalname,
      published: true,
      createdAt: new Date().toISOString()
    };

    d.products.unshift(p);
    save(d);

    res.json(p);
  }
);

app.delete(
  '/api/admin/products/:id',
  admin,
  (req, res) => {
    const d = db();

    const i = d.products.findIndex(
      x => x.id === req.params.id
    );

    if (i < 0) {
      return res.status(404).json({
        error: 'Not found'
      });
    }

    const p = d.products[i];

    try {
      fs.unlinkSync(
        path.join(UPLOADS, p.filename)
      );
    } catch {}

    d.products.splice(i, 1);
    save(d);

    res.json({ ok: true });
  }
);

/* =========================
   CONFIG
========================= */

app.get('/api/config', (req, res) => {
  res.json({
    paymentNumber: PAYMENT_NUMBER,
    brand: 'NoteGhor'
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(
    `NoteGhor running on http://localhost:${PORT}`
  );
});
