/* =====================================================================
   motor.js — Motor de cálculo GoMining (compartido)
   ---------------------------------------------------------------------
   Lo usan tanto el panel privado (gomining-dashboard.html) como la
   calculadora pública. Script clásico a propósito: NO es un módulo ES,
   así ambas páginas siguen abriéndose con doble clic desde file://
   sin build ni servidor.

   REGLA DE ESTE ARCHIVO: ninguna constante sin comentario de fuente
   y fecha de verificación. Si GoMining cambia condiciones, se toca
   AQUÍ y en ningún otro sitio (ver README.md).
   ===================================================================== */
(function (global) {
"use strict";

/* =====================================================================
   1. CONSTANTES — todas con fuente y fecha
   ===================================================================== */

const CONST = {

  /* --- Costes de GoMining ------------------------------------------ */

  // Fee de servicio por TH y día.
  // Fuente: https://help.nft.gomining.com/faq/mining
  //   "service charges for 1 TH per day is $0.0089"
  // Verificado: 24 jul 2026
  SERVICIO_USD_TH_DIA: 0.0089,

  // Precio de la electricidad en los data centers de GoMining.
  // Fuente: https://help.nft.gomining.com/faq/mining
  //   "Our electricity prices range from $0.05 to $0.07"
  // Verificado: 24 jul 2026
  KWH_MIN: 0.05,
  KWH_DEFECTO: 0.05,
  KWH_MAX: 0.07,

  /* --- Niveles de eficiencia (W/TH) --------------------------------- */

  // 12 W/TH es el ÚNICO nivel de los mineros nuevos del mercado primario.
  // 15 W/TH es el otro nivel habitual (MINEBOX y 2ª mano reciente).
  // Por encima de 28 W/TH GoMining ya no permite mejoras de potencia.
  // Fuente: https://gomining.com/blog/12-w-th
  //         https://gomining.com/blog/streamline-your-mining-farm-with-15-w-th-efficiency
  //         https://academy.gomining.com/articles/gomining-miner-tiers-compared
  // Verificado: 24 jul 2026
  WTH_MEJOR: 12,          // suelo alcanzable hoy
  WTH_PRIMARIO: 12,       // lo que compras nuevo
  WTH_HABITUAL: 15,       // el otro nivel corriente
  WTH_SIN_UPGRADE: 28,    // por encima de esto ya no se puede mejorar
  WTH_MAX_RAZONABLE: 200, // límite defensivo del formulario

  /* --- Descuentos de mantenimiento --------------------------------- */

  // Descuento por pagar el mantenimiento en token GOMINING: 1% por cada
  // 18 días de cobertura acumulada, hasta un máximo del 20% a los 360 días.
  // Fuente: https://help.nft.gomining.com/faq/maintenance-fees-and-discounts
  //   "18-35 days -> 1% ... 360+ days -> 20%"
  // Verificado: 24 jul 2026
  GMT_DIAS_POR_PUNTO: 18,
  GMT_DESCUENTO_MAX: 20,

  // Descuento VIP, automático según nivel de la cuenta.
  // Fuente: https://help.nft.gomining.com/faq/maintenance-fees-and-discounts
  //   "0.3% discount for the Bronze II VIP level ... 6% for the maximum Elite level"
  // Verificado: 24 jul 2026
  VIP_MIN: 0.3,
  VIP_MAX: 6,

  // Botón de servicio diario: +0,3% por día consecutivo, tope 3% (10 días).
  // Se reinicia si te saltas un día UTC.
  // Fuente: https://help.nft.gomining.com/faq/maintenance-fees-and-discounts
  //   "Each day you click the button, your discount increases by +0.3%"
  //   "Maximum discount: 3%"
  // Verificado: 24 jul 2026
  SERVICE_PCT_POR_DIA: 0.3,
  SERVICE_MAX: 3,
  SERVICE_DIAS_MAX: 10,

  // Descuento extra de Solo Mining. OJO: es VARIABLE — lo fija la votación
  // semanal de veGOMINING (Burn & Mint), no hay valor fijo publicado, y NO
  // se aplica a mineros en Miner Wars.
  // Fuente: https://help.token.gomining.com/faq/tokenomics/voting
  //   "extra Solo Mining discount ... updated weekly and automatically"
  // Verificado: 24 jul 2026
  // El tope de 3% que usábamos antes NO está documentado en ninguna parte:
  // se deja como límite defensivo del input, marcado como estimación.
  SOLO_MAX_ESTIMADO: 3,
  SOLO_MAX_ES_ESTIMACION: true,

  // Tope del descuento combinado.
  // La documentación oficial NO define un cap explícito. El techo aritmético
  // de los tres descuentos documentados es 20 + 6 + 3 = 29%.
  // Fuente: suma de los tres anteriores (help.nft.gomining.com), 24 jul 2026
  // NOTA: el valor 29,82 que había antes en el código no tiene fuente
  // pública; probablemente se leyó del panel personal. Se conserva como
  // ajustable por el usuario, pero el defecto pasa a ser el documentado.
  CAP_DESCUENTO_DEFECTO: 29,

  /* --- Red Bitcoin -------------------------------------------------- */

  // Bloques por día en el diseño de Bitcoin (1 cada 10 min).
  // Fuente: protocolo Bitcoin. Verificado: 24 jul 2026
  BLOQUES_POR_DIA: 144,

  // El subsidio se divide entre 2 cada 210.000 bloques.
  // Fuente: protocolo Bitcoin. Verificado: 24 jul 2026
  BLOQUES_POR_HALVING: 210000,
  SUBSIDIO_INICIAL_BTC: 50,

  // Estado de la red en la última verificación manual. Se usa SOLO como
  // fallback si mempool.space no responde; la UI debe marcarlo como estimado.
  // Fuente: https://mempool.space/api/v1/mining/hashrate/3d (dificultad)
  //         https://mempool.space/api/v1/mining/reward-stats/144
  // Verificado: 11 oct 2026
  RED_FALLBACK: {
    hashrateTH: 950018149,      // 950,02 EH/s implícitos en la dificultad 132,72 T
    alturaBloque: 970957,       // tip en la verificación
    feesSatsPorBloque: 1361490, // 196.054.623 sats / 144 bloques = 0,0136 BTC
    ts: 1791676800000           // 11 oct 2026
  },

  // Precios de fallback si CoinGecko no responde. Marcar como estimado en UI.
  // Fuente: https://api.coingecko.com/api/v3/simple/price
  // Verificado: 8 oct 2026
  PRECIOS_FALLBACK: { btc: 82607, gmt: 0.3883 },

  /* --- Calibración pool/plataforma ---------------------------------- */

  // GoMining NO paga exactamente el reward teórico de la red: hay comisión
  // de pool, suerte y overhead de plataforma. Medido el 10 oct 2026 con 30
  // días de pagos reales (CSV de ingresos de un minero de 96 TH):
  //   teórico = recompensa_bloque × 86.400 × 1e12 ÷ (dificultad × 2^32)
  //   pagado / teórico = 0,995 de media, día a día entre 0,991 y 1,004
  // El 0,952 anterior (24 jul 2026) era un error nuestro: el teórico se
  // sacó de la estimación de hashrate, que va por delante de la dificultad
  // y lo inflaba. Por eso el teórico se calcula ahora con la dificultad
  // (ver traerRed).
  // Fuente: CSV de pagos de GoMining contra mempool.space.
  // Verificado: 10 oct 2026
  // Recalíbralo con calibrarFactorPool() usando tu sat/TH real. Ver README.md.
  FACTOR_POOL_DEFECTO: 0.995,

  /* --- Varios -------------------------------------------------------- */

  // Días por mes medio (365,25 / 12), para proyecciones.
  DIAS_POR_MES: 30.4375,

  // Refresco de datos en vivo: 8 min. CoinGecko free tier tolera de sobra
  // este ritmo y evita golpear la API en cada recálculo.
  // Fuente: política de rate limit de CoinGecko free. Verificado: 24 jul 2026
  REFRESCO_MS: 8 * 60 * 1000
};

/* =====================================================================
   2. MODELO DE RED — de dónde salen realmente los sat/TH
   ---------------------------------------------------------------------
   Fórmula (la que pide la documentación de minería estándar):

     BTC/día por TH = (1 / hashrate_red_TH) × 144 × (subsidio + fees_medias)

   y luego se multiplica por el factor de pool, porque GoMining se queda
   una parte (≈0,5%). El hashrate es el que implica la dificultad, no la
   estimación de mempool: el pago esperado por TH lo fija la dificultad.
   ===================================================================== */

/** Subsidio de bloque en BTC a una altura dada. Halving cada 210.000. */
function subsidioEnAltura(altura) {
  const epoca = Math.floor(altura / CONST.BLOQUES_POR_HALVING);
  if (epoca >= 33) return 0;                       // más allá, subsidio nulo
  return CONST.SUBSIDIO_INICIAL_BTC / Math.pow(2, epoca);
}

/** Altura del próximo halving y días estimados hasta él. */
function proximoHalving(altura) {
  const epoca = Math.floor(altura / CONST.BLOQUES_POR_HALVING);
  const alturaHalving = (epoca + 1) * CONST.BLOQUES_POR_HALVING;
  const bloquesRestantes = alturaHalving - altura;
  const dias = bloquesRestantes / CONST.BLOQUES_POR_DIA;
  const fecha = new Date(Date.now() + dias * 86400000);
  return {
    altura: alturaHalving,
    bloquesRestantes,
    dias: Math.round(dias),
    fecha,
    subsidioActual: subsidioEnAltura(altura),
    subsidioTras: subsidioEnAltura(alturaHalving)
  };
}

/**
 * sat/TH/día que emite la RED (bruto, antes de la comisión del pool).
 * @param red {hashrateTH, alturaBloque, feesSatsPorBloque}
 */
function satTHTeorico(red) {
  if (!red || !(red.hashrateTH > 0)) return 0;
  const subsidioSats = subsidioEnAltura(red.alturaBloque) * 1e8;
  const porBloque = subsidioSats + (red.feesSatsPorBloque || 0);
  return CONST.BLOQUES_POR_DIA * porBloque / red.hashrateTH;
}

/**
 * sat/TH/día que realmente te paga GoMining = teórico × factor de pool.
 */
function satTHNeto(red, factorPool) {
  const f = factorPool > 0 ? factorPool : CONST.FACTOR_POOL_DEFECTO;
  return satTHTeorico(red) * f;
}

/**
 * Calibra el factor de pool comparando tu sat/TH real con el teórico.
 * Mete el valor que veas en tu dashboard de GoMining y esto te dice
 * qué porcentaje del reward de red estás cobrando de verdad.
 */
function calibrarFactorPool(satTHReal, red) {
  const teorico = satTHTeorico(red);
  if (!(teorico > 0) || !(satTHReal > 0)) return null;
  return satTHReal / teorico;
}

/**
 * Resuelve el sat/TH a usar según el modo elegido:
 *   'manual' → el número que teclea el usuario (lo que hacía la app antes)
 *   'red'    → derivado de la red en vivo × factor de pool
 * Devuelve también el origen, para que la UI pueda marcarlo.
 */
function resolverSatTH(aj, red) {
  if (aj.modoSatTH === "red" && red && red.hashrateTH > 0) {
    return {
      satTH: satTHNeto(red, aj.factorPool),
      origen: "red",
      teorico: satTHTeorico(red),
      estimado: !!red.esFallback
    };
  }
  return { satTH: aj.satTH || 0, origen: "manual", teorico: satTHTeorico(red), estimado: false };
}

/* =====================================================================
   3. COSTES DIARIOS DEL MINERO
   ===================================================================== */

/** Electricidad USD/día = $/kWh × 24/1000 × W/TH × TH  (fórmula oficial) */
function electricidadUSDdia(m, kwh) {
  return kwh * 24 / 1000 * m.wth * m.th;
}

/** Servicio USD/día = 0,0089 × TH */
function servicioUSDdia(m) {
  return CONST.SERVICIO_USD_TH_DIA * m.th;
}

/* =====================================================================
   4. DESCUENTOS DE MANTENIMIENTO
   ===================================================================== */

/**
 * Descuento por cobertura en token GOMINING.
 * días_cobertura = saldo_GOMINING_en_USD ÷ fee BRUTA diaria de toda la flota.
 * Se usa la fee bruta (sin descuentos) a propósito: si usáramos la ya
 * descontada, el descuento dependería de sí mismo (circularidad).
 */
function descuentoGMT(saldoGmtTokens, pGMT, feeBrutaFlota) {
  if (feeBrutaFlota <= 0 || pGMT <= 0 || saldoGmtTokens <= 0) return { pct: 0, dias: 0 };
  const dias = (saldoGmtTokens * pGMT) / feeBrutaFlota;
  const pct = Math.min(Math.floor(dias / CONST.GMT_DIAS_POR_PUNTO), CONST.GMT_DESCUENTO_MAX);
  return { pct, dias };
}

/** Botón de servicio: 0,3% por día consecutivo, tope 3%. */
function descuentoService(racha) {
  return Math.min(racha * CONST.SERVICE_PCT_POR_DIA, CONST.SERVICE_MAX);
}

/* =====================================================================
   5. CÁLCULO DE LA FLOTA
   ---------------------------------------------------------------------
   Función pura: recibe todo por parámetro para poder simular escenarios
   clonando la flota. Es lo que permite al simulador capturar efectos
   cruzados (más TH ⇒ más fee ⇒ menos cobertura GMT ⇒ menos descuento).
   ===================================================================== */

/**
 * @param mineros [{th, wth, precio, modo}] — modo: 'solo' | 'wars'
 * @param aj {satTH, modoSatTH, factorPool, kwh, saldoGMT, vip, racha, descSolo, cap, proteccion}
 * @param pBTC precio BTC/USD   @param pGMT precio GOMINING/USD
 * @param red  estado de la red (opcional; sólo si modoSatTH === 'red')
 */
function calcularFlota(mineros, aj, pBTC, pGMT, red) {
  const sat = resolverSatTH(aj, red);
  const satTH = sat.satTH;

  // Fee bruta de toda la flota: base para la cobertura GMT
  const feeBruta = mineros.reduce(
    (a, m) => a + electricidadUSDdia(m, aj.kwh) + servicioUSDdia(m), 0);
  const gmt = descuentoGMT(aj.saldoGMT, pGMT, feeBruta);
  const dService = descuentoService(aj.racha);

  const detalle = mineros.map(m => {
    const brutoBTC = satTH * m.th / 1e8;
    const brutoUSD = brutoBTC * pBTC;
    const elec = electricidadUSDdia(m, aj.kwh);
    const serv = servicioUSDdia(m);
    // El descuento de solo mining NO aplica a mineros en Miner Wars
    const dSolo = m.modo === "solo" ? aj.descSolo : 0;
    const dTot = Math.min(gmt.pct + aj.vip + dService + dSolo, aj.cap);
    const mant = (elec + serv) * (1 - dTot / 100);
    const netoReal = brutoUSD - mant;                      // sin Reward Protection
    const neto = (aj.proteccion && netoReal < 0) ? 0 : netoReal;
    return {
      ...m, brutoBTC, brutoUSD, elec, serv, dTot, dSolo, mant, netoReal, neto,
      netoBTC: pBTC > 0 ? neto / pBTC : 0
    };
  });

  const th = detalle.reduce((a, m) => a + m.th, 0);
  const tot = {
    th,
    wthMedio: th > 0 ? detalle.reduce((a, m) => a + m.wth * m.th, 0) / th : 0,
    brutoBTC: detalle.reduce((a, m) => a + m.brutoBTC, 0),
    brutoUSD: detalle.reduce((a, m) => a + m.brutoUSD, 0),
    mant:     detalle.reduce((a, m) => a + m.mant, 0),
    neto:     detalle.reduce((a, m) => a + m.neto, 0),
    netoReal: detalle.reduce((a, m) => a + m.netoReal, 0),
    netoBTC:  detalle.reduce((a, m) => a + m.netoBTC, 0)
  };

  // Descuento total por modo, expuesto aquí para que la UI no lo recalcule
  const dTotSolo = Math.min(gmt.pct + aj.vip + dService + aj.descSolo, aj.cap);
  const dTotWars = Math.min(gmt.pct + aj.vip + dService, aj.cap);

  return { detalle, tot, feeBruta, gmt, dService, dTotSolo, dTotWars, satTH: sat };
}

/* =====================================================================
   6. MÉTRICAS DE INVERSIÓN
   ===================================================================== */

/** Inversión total de un minero = compra + suma en USD de sus mejoras. */
function inversionMinero(m) {
  return (m.precio || 0) + (m.mejoras || []).reduce((a, x) => a + (x.costeUSD || 0), 0);
}

/**
 * Breakeven y ROI. Devuelve días hasta recuperar y % anual sobre lo invertido.
 * Con netoDia <= 0 no hay breakeven posible: devuelve null, no infinito.
 */
function breakeven(inversionUSD, netoUSDdia) {
  if (!(inversionUSD > 0) || !(netoUSDdia > 0)) {
    return { dias: null, anios: null, roiAnualPct: null };
  }
  const dias = inversionUSD / netoUSDdia;
  return {
    dias: Math.ceil(dias),
    anios: dias / 365,
    roiAnualPct: netoUSDdia * 365 / inversionUSD * 100
  };
}

/* =====================================================================
   7. PROYECCIÓN TEMPORAL
   ---------------------------------------------------------------------
   Bucle diario. Novedades frente a la versión anterior:
     · la dificultad crece un % mensual configurable (antes: congelada)
     · el halving se aplica al cruzar la altura correspondiente
   Ambas cosas hacían que la proyección a 48 meses fuese optimista.
   ===================================================================== */

/**
 * @param opts {
 *   mineros, aj, pBTC0, pGMT, red,
 *   meses,                  // horizonte
 *   crecimientoBTCanual,    // % anual del precio de BTC
 *   crecimientoDificultadMensual, // % mensual de la dificultad
 *   reinvertir: { activo, freqDias, bonusPct, precioTH, wthNuevo }
 * }
 */
function proyectar(opts) {
  const {
    mineros, aj, pGMT, red,
    meses = 12,
    crecimientoBTCanual = 0,
    crecimientoDificultadMensual = 0,
    reinvertir = null
  } = opts;
  const pBTC0 = opts.pBTC0 || 0;

  const dias = Math.round(meses * CONST.DIAS_POR_MES);
  const gBTC = crecimientoBTCanual / 100;
  const gDif = crecimientoDificultadMensual / 100;
  const alturaHoy = (red && red.alturaBloque) || CONST.RED_FALLBACK.alturaBloque;
  const hashrate0 = (red && red.hashrateTH) || CONST.RED_FALLBACK.hashrateTH;
  const fees0 = red && Number.isFinite(red.feesSatsPorBloque)
    ? red.feesSatsPorBloque : CONST.RED_FALLBACK.feesSatsPorBloque;

  const precioDia = d => pBTC0 * Math.pow(1 + gBTC, d / 365);

  // Estado de red en el día d: la dificultad sube ⇒ el hashrate efectivo
  // de la red sube ⇒ tu cuota baja. El halving corta el subsidio a la mitad.
  const redEnDia = d => ({
    hashrateTH: hashrate0 * Math.pow(1 + gDif, d / CONST.DIAS_POR_MES),
    alturaBloque: alturaHoy + Math.round(d * CONST.BLOQUES_POR_DIA),
    feesSatsPorBloque: fees0,
    esFallback: red ? red.esFallback : true
  });

  const usarRed = aj.modoSatTH === "red";
  // En modo manual el sat/TH no se deriva de la red, pero SÍ debe degradarse
  // con la dificultad y el halving, o la proyección miente igual.
  const satTH0 = resolverSatTH(aj, red).satTH;
  const ajEnDia = d => {
    if (usarRed) return aj;
    const r0 = { hashrateTH: hashrate0, alturaBloque: alturaHoy, feesSatsPorBloque: fees0 };
    const t0 = satTHTeorico(r0), td = satTHTeorico(redEnDia(d));
    const factor = t0 > 0 ? td / t0 : 1;
    return { ...aj, satTH: satTH0 * factor };
  };

  const rein = reinvertir && reinvertir.activo && reinvertir.precioTH > 0 ? reinvertir : null;
  const freq = rein ? Math.max(1, Math.round(rein.freqDias || 1)) : 1;
  const bonus = rein ? (rein.bonusPct || 0) / 100 : 0;

  let acumUSD = 0, acumBTC = 0;      // modo A: cobrar cada día
  let extraTH = 0, caja = 0;          // modo B: reinvertir
  const labels = [], serieSin = [], serieRe = [], serieNetoDia = [];
  const paso = Math.max(1, Math.round(dias / 120));   // ≤120 puntos en la gráfica
  let halvingEnDia = null;

  for (let d = 1; d <= dias; d++) {
    const pBTC = precioDia(d);
    const rd = redEnDia(d);
    const ajd = ajEnDia(d);

    if (halvingEnDia === null &&
        subsidioEnAltura(rd.alturaBloque) < subsidioEnAltura(alturaHoy)) {
      halvingEnDia = d;
    }

    // --- A) sin reinvertir ---
    const fA = calcularFlota(mineros, ajd, pBTC, pGMT, rd);
    acumUSD += fA.tot.neto;
    acumBTC += pBTC > 0 ? fA.tot.neto / pBTC : 0;

    // --- B) reinvirtiendo ---
    let fB = fA;
    if (rein) {
      const flotaB = extraTH > 0
        ? [...mineros, { id: "_re", nombre: "(TH reinvertidos)", th: extraTH, wth: rein.wthNuevo, precio: 0, modo: "solo" }]
        : mineros;
      fB = calcularFlota(flotaB, ajd, pBTC, pGMT, rd);
      caja += fB.tot.neto;
      // Un déficit se conserva en caja hasta cubrirlo; nunca vende TH
      // ficticios ni borra pérdidas para financiar la siguiente compra.
      if (caja > 0 && (d % freq === 0 || d === dias)) {
        extraTH += caja * (1 + bonus) / rein.precioTH;
        caja = 0;
      }
    }

    if (d % paso === 0 || d === dias) {
      labels.push(d);
      serieSin.push(acumUSD);
      serieRe.push(rein ? extraTH * rein.precioTH + caja : acumUSD);
      serieNetoDia.push(fA.tot.neto);
    }
  }

  const pFin = precioDia(dias);
  const redFin = redEnDia(dias);
  const flotaFinal = rein && extraTH > 0
    ? [...mineros, { id: "_re", nombre: "(TH reinvertidos)", th: extraTH, wth: rein.wthNuevo, precio: 0, modo: "solo" }]
    : mineros;
  const fFin = calcularFlota(flotaFinal, ajEnDia(dias), pFin, pGMT, redFin);

  return {
    labels, serieSin, serieRe, serieNetoDia,
    acumUSD, acumBTC, extraTH, dias, pFin,
    netoFinalDia: fFin.tot.neto,
    thFinal: fFin.tot.th,
    satTHFinal: fFin.satTH.satTH,
    halvingEnDia
  };
}

/* =====================================================================
   8. DATOS EN VIVO — CoinGecko + mempool.space
   ---------------------------------------------------------------------
   Con caché en memoria y fallback explícito. Ninguna de las dos APIs
   necesita clave. Si una falla, se devuelve el último valor conocido o
   la constante de fallback, SIEMPRE con esFallback:true para que la UI
   lo marque como estimado.
   ===================================================================== */

// Precio de BTC y del token GOMINING.
// OJO con el id: en CoinGecko el token de GoMining es "gmt-token"
// (symbol "gomining", name "GoMining Token"). Verificado 24 jul 2026 —
// NO confundir con STEPN, que es otro proyecto con ticker GMT.
const URL_PRECIOS = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,gmt-token&vs_currencies=usd";

// Hashrate y dificultad actuales de la red.
const URL_HASHRATE = "https://mempool.space/api/v1/mining/hashrate/3d";

// Reward real de los últimos 144 bloques (≈1 día): subsidio + fees + altura.
const URL_REWARD = "https://mempool.space/api/v1/mining/reward-stats/144";

async function pedirJSON(url, ms = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/** Precios. Devuelve {btc, gmt, ts, esFallback, error}. */
async function traerPrecios(ultimo) {
  try {
    const j = await pedirJSON(URL_PRECIOS);
    const btc = j.bitcoin && j.bitcoin.usd;
    const gmt = j["gmt-token"] && j["gmt-token"].usd;
    if (!(btc > 0)) throw new Error("respuesta sin precio de BTC");
    return { btc, gmt: gmt > 0 ? gmt : (ultimo && ultimo.gmt) || CONST.PRECIOS_FALLBACK.gmt,
             ts: Date.now(), esFallback: false, error: null };
  } catch (e) {
    const base = (ultimo && ultimo.btc > 0) ? ultimo : CONST.PRECIOS_FALLBACK;
    return { btc: base.btc, gmt: base.gmt, ts: (ultimo && ultimo.ts) || CONST.RED_FALLBACK.ts,
             esFallback: true, error: e.message };
  }
}

/** Estado de la red. Devuelve {hashrateTH, alturaBloque, feesSatsPorBloque, ts, esFallback, error}. */
async function traerRed(ultimo) {
  try {
    const [h, r] = await Promise.all([pedirJSON(URL_HASHRATE), pedirJSON(URL_REWARD)]);
    // Hashrate implícito en la dificultad (dificultad × 2^32 / 600 s), no la
    // estimación currentHashrate: esa es ruidosa y puede ir un 5–7% por
    // delante, y lo que se cobra por TH depende de la dificultad vigente.
    const hashrateTH = h.currentDifficulty > 0
      ? h.currentDifficulty * 4294967296 / 600 / 1e12
      : h.currentHashrate / 1e12;                        // H/s → TH/s
    const totalFee = parseFloat(r.totalFee);
    const alturaBloque = parseInt(r.endBlock, 10);
    if (!(hashrateTH > 0) || !(alturaBloque > 0)) throw new Error("respuesta incompleta");
    return {
      hashrateTH,
      alturaBloque,
      feesSatsPorBloque: totalFee / CONST.BLOQUES_POR_DIA,
      dificultad: h.currentDifficulty,
      ts: Date.now(), esFallback: false, error: null
    };
  } catch (e) {
    const base = (ultimo && ultimo.hashrateTH > 0) ? ultimo : CONST.RED_FALLBACK;
    return { ...base, esFallback: true, error: e.message };
  }
}

/** "hace X min" / "X min ago", para el sello de frescura de los datos. */
const HACE = {
  es: { nada: "sin datos", seg: "hace unos segundos", min: n => "hace " + n + " min",
        h: n => "hace " + n + (n === 1 ? " hora" : " horas"), d: n => "hace " + n + (n === 1 ? " día" : " días") },
  en: { nada: "no data", seg: "seconds ago", min: n => n + " min ago",
        h: n => n + (n === 1 ? " hour ago" : " hours ago"), d: n => n + (n === 1 ? " day ago" : " days ago") },
  fr: { nada: "pas de données", seg: "il y a quelques secondes", min: n => "il y a " + n + " min",
        h: n => "il y a " + n + (n === 1 ? " heure" : " heures"), d: n => "il y a " + n + (n === 1 ? " jour" : " jours") },
  pt: { nada: "sem dados", seg: "há alguns segundos", min: n => "há " + n + " min",
        h: n => "há " + n + (n === 1 ? " hora" : " horas"), d: n => "há " + n + (n === 1 ? " dia" : " dias") }
};
function haceCuanto(ts) {
  const t = HACE[IDIOMA];
  if (!ts) return t.nada;
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return t.seg;
  const min = Math.round(s / 60);
  if (min < 60) return t.min(min);
  const h = Math.round(min / 60);
  if (h < 24) return t.h(h);
  return t.d(Math.round(h / 24));
}

/* =====================================================================
   9. FORMATO — español (1.234,56 $), inglés ($1,234.56), francés
      (1 234,56 $) o portugués de Brasil (US$ 1.234,56)
   ---------------------------------------------------------------------
   El idioma SOLO afecta al formato y a las cadenas de tiempo. Ninguna
   fórmula depende de él: los cálculos son idénticos en las dos páginas.

   Por defecto español, que es lo que espera es.html y lo que verifican los
   tests. index.html (la versión inglesa, en la raíz del sitio) llama a
   setIdioma("en") antes de pintar nada.
   El motor se quedó en español por defecto a propósito aunque el idioma
   principal del sitio pasara al inglés: cambiarlo obligaría a rehacer las
   65 comprobaciones de motor.test.js sin ganar nada a cambio.
   ===================================================================== */

let IDIOMA = "es";

/* Francés y portugués llegaron en oct-2026 con la traducción del sitio.
   Portugués es el de Brasil, que es de donde viene ese tráfico. */
const LOCALE = { es: "es-ES", en: "en-US", fr: "fr-FR", pt: "pt-BR" };

/** Cambia el idioma de SALIDA. Devuelve el idioma efectivo. */
function setIdioma(l) {
  IDIOMA = LOCALE[l] ? l : "es";
  return IDIOMA;
}

/* En español el símbolo de moneda va DETRÁS y separado («1.234,56 $») y en
   inglés DELANTE y pegado («$1,234.56»).
   Además, en español se fuerza useGrouping:"always" porque por regla CLDR
   se omite el separador de miles en números de 4 cifras (1234,56 en vez de
   1.234,56). Para cantidades de dinero el separador se lee mejor siempre.
   En francés va detrás como en español; en Brasil el dólar se escribe
   delante y separado: «US$ 1.234,56». */
const fmtU = (x, d = 2) => {
  const n = x.toLocaleString(LOCALE[IDIOMA], {
    minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always"
  });
  // El signo va SIEMPRE delante del símbolo: «-$5.00», no «$-5.00».
  if (IDIOMA === "en") return n.startsWith("-") ? "-$" + n.slice(1) : "$" + n;
  if (IDIOMA === "pt") return n.startsWith("-") ? "-US$ " + n.slice(1) : "US$ " + n;
  return n + " $";
};

/** Importes diarios pequeños con más decimales, para que no salgan a 0,00 $. */
const fmtUsdDia = x => fmtU(x, Math.abs(x) >= 1 ? 2 : 4);

const fmtBTC = x => x.toLocaleString(LOCALE[IDIOMA],
  { minimumFractionDigits: 8, maximumFractionDigits: 8 }) + " ₿";

/* Para números sueltos (TH, W/TH, días) se deja el agrupado automático:
   «1234 TH» es lo natural en español, no «1.234 TH». */
const fmtN = (x, d = 2) => x.toLocaleString(LOCALE[IDIOMA],
  { minimumFractionDigits: 0, maximumFractionDigits: d });

const fmtPct = (x, d = 1) => fmtN(x, d) + "%";

/** Hashrate legible: 915,33 EH/s en vez de 915331674 TH/s. */
function fmtHashrate(th) {
  if (!(th > 0)) return "—";
  if (th >= 1e6) return fmtN(th / 1e6, 2) + " EH/s";
  if (th >= 1e3) return fmtN(th / 1e3, 2) + " PH/s";
  return fmtN(th, 2) + " TH/s";
}

/* =====================================================================
   10. EXPORTACIÓN
   ===================================================================== */

global.MotorGoMining = {
  CONST,
  // red
  subsidioEnAltura, proximoHalving, satTHTeorico, satTHNeto,
  calibrarFactorPool, resolverSatTH,
  // costes y descuentos
  electricidadUSDdia, servicioUSDdia, descuentoGMT, descuentoService,
  // núcleo
  calcularFlota, inversionMinero, breakeven, proyectar,
  // datos en vivo
  traerPrecios, traerRed, haceCuanto,
  // formato e idioma de salida
  setIdioma, fmtU, fmtUsdDia, fmtBTC, fmtN, fmtPct, fmtHashrate
};

})(typeof globalThis !== "undefined" ? globalThis : this);
