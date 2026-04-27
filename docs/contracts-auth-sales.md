# Contrato API - Auth + Sales (v2)

## POST `/api/auth/login`

### Request

```json
{
  "username": "admin",
  "password": "1234"
}
```

### Response 200

```json
{
  "ok": true,
  "user": {
    "id": 1,
    "username": "admin",
    "display_name": "Admin",
    "role": "admin"
  },
  "session": {
    "token": "<opaque-token>",
    "token_type": "Bearer",
    "expires_at": "2026-04-27T00:00:00.000Z"
  }
}
```

### Errores

- `400`: faltan `username` o `password`.
- `401`: credenciales invalidas.

## POST `/api/auth/logout`

### Headers

- `Authorization: Bearer <token>`

### Response 200

```json
{
  "ok": true,
  "revoked": true
}
```

### Errores

- `401`: token ausente, invalido o expirado.

## POST `/api/scanner/sales`

### Headers

- `Authorization: Bearer <token>`
- Roles permitidos: `admin`, `operario`

### Request

```json
{
  "externalId": "sale-1714172400000",
  "userId": 1,
  "notes": "venta caja principal",
  "items": [
    {
      "id": "1",
      "productId": 1,
      "isManual": false,
      "nombre": "Yerba",
      "precio_venta": 120,
      "quantity": 2,
      "thumbnail_url": null
    },
    {
      "id": "manual-line-1",
      "productId": null,
      "isManual": true,
      "nombre": "Producto Manual",
      "precio_venta": 50,
      "quantity": 1,
      "thumbnail_url": null
    }
  ]
}
```

### Response 201

```json
{
  "ok": true,
  "sale": {
    "id": 10,
    "external_id": "sale-1714172400000",
    "total_amount": 290,
    "items_count": 3,
    "created_at": "2026-04-26T20:00:00.000Z"
  }
}
```

### Errores

- `400`: payload invalido (sin items, item sin nombre, precio invalido, quantity invalida).
- `409`: `externalId` duplicado.

## POST `/api/scanner/payments`

### Headers

- `Authorization: Bearer <token>`
- Roles permitidos: `admin`

### Request

```json
{
  "externalId": "payment-1714172400000",
  "userId": 1,
  "amount": 350,
  "description": "Proveedor limpieza"
}
```

### Response 201

```json
{
  "ok": true,
  "payment": {
    "id": 8,
    "external_id": "payment-1714172400000",
    "amount": 350,
    "description": "Proveedor limpieza",
    "created_at": "2026-04-26T20:15:00.000Z"
  }
}
```

### Errores

- `400`: monto invalido.
- `409`: `externalId` duplicado.

## GET `/api/scanner/dashboard`

### Headers

- `Authorization: Bearer <token>`
- Roles permitidos: `admin`

### Query params opcionales

- `date=YYYY-MM-DD` (default: hoy)
- `initialCash=1000` (default: 1000)
- `profitRate=0.2` (default: 0.2)
- `movementLimit=100` (default: 100)
- `rankingLimit=20` (default: 20)

### Response 200

```json
{
  "ok": true,
  "dashboard": {
    "date": "2026-04-26",
    "metrics": {
      "initialCash": 1000,
      "salesToday": 290,
      "profitToday": 58,
      "currentAmount": 940,
      "paymentsTotal": 350,
      "profitRate": 0.2
    },
    "comparison": {
      "today": 290,
      "yesterday": 120,
      "record": 400
    },
    "movements": [
      {
        "id": "sale-10",
        "type": "Venta",
        "amount": 290,
        "createdAt": "2026-04-26T20:00:00.000Z",
        "detail": {
          "kind": "sale",
          "operator": "Operario",
          "createdAt": "2026-04-26T20:00:00.000Z",
          "items": [
            { "id": 1, "name": "Yerba", "quantity": 2, "lineTotal": 240 }
          ]
        }
      },
      {
        "id": "payment-8",
        "type": "Pago",
        "amount": -350,
        "createdAt": "2026-04-26T20:15:00.000Z",
        "detail": {
          "kind": "payment",
          "description": "Proveedor limpieza"
        }
      }
    ],
    "ranking": [
      { "key": "product:1", "name": "Yerba", "qty": 2 },
      { "key": "manual:Producto Manual", "name": "Producto Manual", "qty": 1 }
    ]
  }
}
```

## Notas de seguridad (estado actual)

- `login` crea sesion persistida en `auth_sessions`.
- `dashboard`, `sales` y `payments` requieren token `Bearer` valido y no expirado.
- `logout` revoca la sesion actual.
- `password_hash` soporta:
  - `scrypt:<N>:<r>:<p>:<saltHex>:<digestHex>` (recomendado)
  - `sha256:<hex>`
  - `plain:<password>`
  - fallback literal para compatibilidad inicial.
