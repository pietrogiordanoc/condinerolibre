const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const flush = () => new Promise((resolve) => setImmediate(resolve));

function createClient(rows, options = {}) {
  return {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'admin' } } }, error: null }) },
    from(table) {
      assert.equal(table, 'manual_payment_alerts');
      let userId;
      let update;
      return {
        select() { return this; },
        eq(column, value) { assert.equal(column, 'user_id'); userId = value; return this; },
        async maybeSingle() {
          if (options.error) return { data: null, error: new Error('connection failed') };
          if (update && rows.has(userId)) rows.set(userId, { ...rows.get(userId), ...update });
          return { data: rows.get(userId) || null, error: null };
        },
        update(values) { update = values; return this; },
        async upsert(values) {
          if (options.error) return { error: new Error('connection failed') };
          rows.set(values.user_id, values);
          return { error: null };
        }
      };
    }
  };
}

function adminContext(client, options = {}) {
  const ids = ['paymentAlertUser', 'paymentAlertMessage', 'paymentAlertStatus', 'savePaymentAlertBtn', 'disablePaymentAlertBtn', 'modalPaymentAlert'];
  const elements = Object.fromEntries(ids.map((id) => [id, { style: {}, value: '', textContent: '', disabled: false }]));
  const context = vm.createContext({
    document: { getElementById: (id) => elements[id], querySelectorAll: () => [] },
    PROFILES: [{ id: 'user-1', full_name: 'Alumno', email: 'alumno@example.test' }],
    sp: client,
    fetchAllRows: options.fetchAllRows || (async () => ({ data: [], error: null })),
    Toastify: () => ({ showToast() {} }),
    console: { error() {} },
    Date
  });
  vm.runInContext(read('admin/dashboard/module-payment-alert.js'), context);
  return { context, elements };
}

function portalContext(client, userId) {
  const elements = { paymentAlert: { hidden: true }, paymentAlertText: { textContent: '' } };
  let refresh;
  const context = vm.createContext({
    document: { getElementById: (id) => elements[id] },
    setInterval: (callback, ms) => { assert.equal(ms, 30000); refresh = callback; },
    console: { error() {} }
  });
  vm.runInContext(read('cdl-portal/dashboard/payment-alert.js'), context);
  context.startPaymentAlert(client, userId);
  return { elements, refresh: () => refresh() };
}

test('admin activa un mensaje propio y lo desactiva sin guardar cambios pendientes', async () => {
  const rows = new Map();
  const { context, elements } = adminContext(createClient(rows));
  await context.refreshPaymentAlertIndicators();
  await context.openPaymentAlertModal('user-1');
  elements.paymentAlertMessage.value = 'Revisa tu pago';
  await elements.savePaymentAlertBtn.onclick();
  assert.equal(rows.get('user-1').message, 'Revisa tu pago');
  assert.equal(rows.get('user-1').active, true);
  assert.match(context.paymentAlertButton('user-1'), /payment-alert-active/);
  assert.match(context.paymentAlertButton('user-1', true), /Aviso activo/);

  elements.paymentAlertMessage.value = '';
  await elements.disablePaymentAlertBtn.onclick();
  assert.equal(rows.get('user-1').active, false);
  assert.equal(rows.get('user-1').message, 'Revisa tu pago');
  assert.doesNotMatch(context.paymentAlertButton('user-1'), /payment-alert-active/);
  assert.match(context.paymentAlertButton('user-1'), /Aviso de pago/);
});

test('el indicador carga el estado guardado y distingue errores de estados inactivos', async () => {
  let fail = false;
  const { context } = adminContext(createClient(new Map()), {
    fetchAllRows: async () => fail
      ? { data: [], error: new Error('connection failed') }
      : { data: [{ user_id: 'user-1' }], error: null }
  });
  await context.refreshPaymentAlertIndicators();
  assert.match(context.paymentAlertButton('user-1'), /Aviso activo/);
  assert.doesNotMatch(context.paymentAlertButton('user-2'), /payment-alert-active/);

  fail = true;
  await context.refreshPaymentAlertIndicators();
  assert.match(context.paymentAlertButton('user-1'), /Estado del aviso no disponible/);
});

test('una consulta anterior no sobrescribe el estado recién activado', async () => {
  let resolveFirst;
  let requests = 0;
  const { context } = adminContext(createClient(new Map()), {
    fetchAllRows: () => {
      requests++;
      if (requests === 1) return new Promise((resolve) => { resolveFirst = resolve; });
      return Promise.resolve({ data: [{ user_id: 'user-1' }], error: null });
    }
  });
  const oldRequest = context.refreshPaymentAlertIndicators();
  context.setPaymentAlertIndicator('user-1', true);
  await flush();
  resolveFirst({ data: [], error: null });
  await oldRequest;
  assert.match(context.paymentAlertButton('user-1'), /Aviso activo/);
});

test('portal muestra solo el aviso activo del usuario y actualiza al cambiarlo', async () => {
  const rows = new Map([['user-1', { active: true, message: '<b>Revisa PayPal</b>' }]]);
  const client = createClient(rows);
  const first = portalContext(client, 'user-1');
  const other = portalContext(client, 'user-2');
  await flush();
  assert.equal(first.elements.paymentAlert.hidden, false);
  assert.equal(first.elements.paymentAlertText.textContent, '<b>Revisa PayPal</b>');
  assert.equal(other.elements.paymentAlert.hidden, true);

  rows.get('user-1').active = false;
  first.refresh();
  await flush();
  assert.equal(first.elements.paymentAlert.hidden, true);
  assert.equal(first.elements.paymentAlertText.textContent, '');
});

test('un error de lectura no borra el aviso visible ni permite editar sin cargarlo', async () => {
  const rows = new Map([['user-1', { active: true, message: 'Revisa tu pago' }]]);
  const options = {};
  const client = createClient(rows, options);
  const portal = portalContext(client, 'user-1');
  await flush();
  options.error = true;
  portal.refresh();
  await flush();
  assert.equal(portal.elements.paymentAlert.hidden, false);
  assert.equal(portal.elements.paymentAlertText.textContent, 'Revisa tu pago');

  const { context, elements } = adminContext(client);
  await context.openPaymentAlertModal('user-1');
  assert.equal(elements.savePaymentAlertBtn.disabled, true);
  assert.match(elements.paymentAlertStatus.textContent, /No se pudo cargar/);
});

test('si falla la activación, informa del error y conserva el estado anterior', async () => {
  const rows = new Map([['user-1', { active: false, message: 'Mensaje anterior' }]]);
  const options = {};
  const { context, elements } = adminContext(createClient(rows, options));
  await context.openPaymentAlertModal('user-1');
  elements.paymentAlertMessage.value = 'Mensaje nuevo';
  options.error = true;
  await elements.savePaymentAlertBtn.onclick();
  assert.equal(rows.get('user-1').active, false);
  assert.equal(rows.get('user-1').message, 'Mensaje anterior');
  assert.match(elements.paymentAlertStatus.textContent, /No se pudo guardar/);
  assert.equal(elements.savePaymentAlertBtn.disabled, false);
  assert.equal(elements.disablePaymentAlertBtn.disabled, true);
});
