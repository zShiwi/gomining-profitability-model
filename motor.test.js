/* =====================================================================
   motor.test.js — Tests del motor de cálculo
   ---------------------------------------------------------------------
   Ejecutar:  node motor.test.js
   Sin dependencias: no hay npm, no hay framework. Sólo Node.
   Las funciones del motor son puras, así que se testean directamente.
   ===================================================================== */
"use strict";

require("./motor.js");
const M = globalThis.MotorGoMining;

let ok = 0, fallos = 0;
const casi = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

function comprobar(nombre, real, esperado, tol) {
  const bien = typeof esperado === "number" ? casi(real, esperado, tol ?? 1e-6) : real === esperado;
  if (bien) { ok++; console.log("  ok   " + nombre); }
  else { fallos++; console.log("  FALLO " + nombre + "\n        esperado: " + esperado + "\n        real:     " + real); }
}

// Estado de la red verificado el 24 jul 2026 (ver CONST.RED_FALLBACK)
const RED = {
  hashrateTH: 915331674,
  alturaBloque: 959457,
  feesSatsPorBloque: 271623970 / 144
};

console.log("\n— Subsidio y halving —");
comprobar("subsidio a la altura actual = 3,125 BTC", M.subsidioEnAltura(959457), 3.125);
comprobar("subsidio en el bloque 0 = 50 BTC", M.subsidioEnAltura(0), 50);
comprobar("subsidio justo tras el 1er halving = 25 BTC", M.subsidioEnAltura(210000), 25);
comprobar("subsidio tras el halving de 2028 = 1,5625 BTC", M.subsidioEnAltura(1050000), 1.5625);

const h = M.proximoHalving(959457);
comprobar("próximo halving en el bloque 1.050.000", h.altura, 1050000);
comprobar("subsidio tras el próximo halving = 1,5625", h.subsidioTras, 1.5625);
comprobar("faltan ~629 días para el halving", h.dias, 629, 1);

console.log("\n— Modelo de red —");
// 144 bloques x (3,125 BTC + 0,0189 BTC) = 452,72 BTC/día = 45.271.623.970 sats
// 45.271.623.970 / 915.331.674 TH = 49,46 sat/TH/día
const teorico = M.satTHTeorico(RED);
comprobar("sat/TH/día teórico ≈ 49,46", teorico, 49.46, 0.01);
comprobar("emisión diaria de la red ≈ 452,72 BTC",
  teorico * RED.hashrateTH / 1e8, 452.72, 0.01);
comprobar("sin hashrate devuelve 0", M.satTHTeorico({ hashrateTH: 0 }), 0);

// El factor de pool reproduce lo que paga GoMining (medido el 10 oct 2026)
comprobar("el factor por defecto es 0,995", M.CONST.FACTOR_POOL_DEFECTO, 0.995);
comprobar("con factor 0,995 salen 49,21 sat/TH",
  M.satTHNeto(RED, 0.995), 49.21, 0.01);
comprobar("calibrar con 49,21 devuelve ~0,995",
  M.calibrarFactorPool(49.21, RED), 0.995, 0.001);

console.log("\n— Costes —");
// 30 TH x 15 W/TH x 24h / 1000 x 0,05 $/kWh = 0,54 $/día
comprobar("electricidad 30 TH @ 15 W/TH, 0,05 $/kWh = 0,54 $",
  M.electricidadUSDdia({ th: 30, wth: 15 }, 0.05), 0.54);
// 30 TH x 0,0089 = 0,267 $/día
comprobar("servicio 30 TH = 0,267 $", M.servicioUSDdia({ th: 30 }), 0.267);

console.log("\n— Descuentos —");
comprobar("botón service, racha 0 = 0%", M.descuentoService(0), 0);
comprobar("botón service, racha 5 = 1,5%", M.descuentoService(5), 1.5);
comprobar("botón service topa en 3% a los 10 días", M.descuentoService(10), 3);
comprobar("botón service no pasa de 3% con racha 30", M.descuentoService(30), 3);

// Cobertura: 18 días exactos = 1%, 360 días = 20%, más no sube
const fee = 1; // 1 $/día de fee bruta ⇒ los tokens en USD son los días
comprobar("cobertura 17 días = 0%", M.descuentoGMT(17, 1, fee).pct, 0);
comprobar("cobertura 18 días = 1%", M.descuentoGMT(18, 1, fee).pct, 1);
comprobar("cobertura 359 días = 19%", M.descuentoGMT(359, 1, fee).pct, 19);
comprobar("cobertura 360 días = 20%", M.descuentoGMT(360, 1, fee).pct, 20);
comprobar("cobertura 9.000 días sigue topando en 20%", M.descuentoGMT(9000, 1, fee).pct, 20);
comprobar("sin saldo no hay descuento", M.descuentoGMT(0, 1, fee).pct, 0);
comprobar("sin flota (fee 0) no hay descuento", M.descuentoGMT(100, 1, 0).pct, 0);

console.log("\n— Flota —");
const AJ = {
  satTH: 47.1, modoSatTH: "manual", factorPool: 0.995, kwh: 0.05,
  saldoGMT: 0, vip: 0, racha: 0, descSolo: 0, cap: 29, proteccion: true
};
const UNO = [{ id: "a", nombre: "A", th: 30, wth: 15, precio: 0, modo: "solo" }];
const f = M.calcularFlota(UNO, AJ, 64211, 0.2894, RED);

// 47,1 sat x 30 TH = 1413 sats = 0,00001413 BTC x 64.211 $ = 0,9073 $
comprobar("bruto BTC/día", f.tot.brutoBTC, 0.00001413, 1e-10);
comprobar("bruto USD/día ≈ 0,9073 $", f.tot.brutoUSD, 0.907301, 1e-5);
comprobar("mantenimiento sin descuentos = 0,807 $", f.tot.mant, 0.807);
comprobar("neto/día ≈ 0,1003 $", f.tot.neto, 0.100301, 1e-5);
comprobar("W/TH medio de un solo minero = su W/TH", f.tot.wthMedio, 15);

// Media ponderada por TH, no media simple: (10x30 + 30x15)/40 = 18,75
const DOS = [
  { id: "a", nombre: "A", th: 10, wth: 30, precio: 0, modo: "solo" },
  { id: "b", nombre: "B", th: 30, wth: 15, precio: 0, modo: "solo" }
];
comprobar("W/TH medio ponderado por TH = 18,75",
  M.calcularFlota(DOS, AJ, 64211, 0.2894, RED).tot.wthMedio, 18.75);

// Miner Wars no recibe el descuento de solo mining
const AJ_SOLO = { ...AJ, descSolo: 2 };
const MIXTA = [
  { id: "a", nombre: "Solo", th: 10, wth: 15, precio: 0, modo: "solo" },
  { id: "b", nombre: "Wars", th: 10, wth: 15, precio: 0, modo: "wars" }
];
const fm = M.calcularFlota(MIXTA, AJ_SOLO, 64211, 0.2894, RED);
comprobar("el minero en Solo recibe el 2% de descuento", fm.detalle[0].dTot, 2);
comprobar("el minero en Wars NO lo recibe", fm.detalle[1].dTot, 0);

// El cap corta la suma de descuentos
const AJ_CAP = { ...AJ, vip: 6, racha: 10, descSolo: 3, saldoGMT: 1e9, cap: 29 };
comprobar("los descuentos topan en el cap del 29%",
  M.calcularFlota(UNO, AJ_CAP, 64211, 0.2894, RED).detalle[0].dTot, 29);

// Reward Protection: neto negativo se muestra como 0 pero netoReal lo conserva
const CARO = { ...AJ, kwh: 0.07 };
const INEFICIENTE = [{ id: "z", nombre: "Z", th: 10, wth: 90, precio: 0, modo: "solo" }];
const fp = M.calcularFlota(INEFICIENTE, CARO, 64211, 0.2894, RED);
comprobar("con protección el neto mostrado no baja de 0", fp.tot.neto, 0);
comprobar("pero el neto real sigue siendo negativo", fp.tot.netoReal < 0, true);
const fsp = M.calcularFlota(INEFICIENTE, { ...CARO, proteccion: false }, 64211, 0.2894, RED);
comprobar("sin protección se muestra el negativo real", fsp.tot.neto < 0, true);

console.log("\n— Modo red vs manual —");
const AJ_RED = { ...AJ, modoSatTH: "red" };
const fr = M.calcularFlota(UNO, AJ_RED, 64211, 0.2894, RED);
comprobar("en modo red el sat/TH se deriva de la red", fr.satTH.origen, "red");
comprobar("y coincide con teórico x factor", fr.satTH.satTH, teorico * 0.995, 1e-9);
comprobar("en modo manual el origen es manual", f.satTH.origen, "manual");

console.log("\n— Breakeven y ROI —");
const be = M.breakeven(365, 1);       // 365 $ invertidos a 1 $/día
comprobar("365 $ a 1 $/día = 365 días", be.dias, 365);
comprobar("… que es 1 año exacto", be.anios, 1);
comprobar("… y un ROI del 100% anual", be.roiAnualPct, 100);
comprobar("sin neto positivo no hay breakeven", M.breakeven(100, 0).dias, null);
comprobar("con neto negativo tampoco", M.breakeven(100, -5).dias, null);
comprobar("sin inversión tampoco", M.breakeven(0, 5).dias, null);

console.log("\n— Proyección —");
const baseProy = {
  mineros: UNO, aj: AJ, pBTC0: 64211, pGMT: 0.2894, red: RED,
  meses: 12, crecimientoBTCanual: 0, crecimientoDificultadMensual: 0, reinvertir: null
};
const p0 = M.proyectar(baseProy);
comprobar("12 meses = 365 días", p0.dias, 365);
comprobar("sin crecimiento, el acumulado = neto/día x días",
  p0.acumUSD, f.tot.neto * 365, 1e-6);

// La dificultad creciente TIENE que reducir el acumulado
const p1 = M.proyectar({ ...baseProy, crecimientoDificultadMensual: 2 });
comprobar("con dificultad +2%/mes se gana menos que sin ella", p1.acumUSD < p0.acumUSD, true);

// El halving también, en un horizonte que lo cruce (629 días ≈ 20,7 meses)
const pLargo = M.proyectar({ ...baseProy, meses: 30 });
comprobar("a 30 meses la proyección detecta el halving", pLargo.halvingEnDia !== null, true);
comprobar("y lo sitúa en el día ~629", pLargo.halvingEnDia, 629, 2);
comprobar("tras el halving el sat/TH final es menor que el inicial",
  pLargo.satTHFinal < 47.1, true);

// Reinvertir debe acabar con más TH de los que empezaste
const pRe = M.proyectar({
  ...baseProy,
  reinvertir: { activo: true, freqDias: 30, bonusPct: 0, precioTH: 10.14, wthNuevo: 15 }
});
comprobar("reinvirtiendo se compran TH", pRe.extraTH > 0, true);
comprobar("y la flota final es mayor que la inicial", pRe.thFinal > 30, true);

// Con flujo de caja negativo, reinvertir no puede restar TH: el déficit se
// queda en caja (no se "venden" TH para cubrirlo). Bug corregido el 8 oct 2026.
const pDef = M.proyectar({
  ...baseProy, mineros: INEFICIENTE, aj: { ...CARO, proteccion: false },
  reinvertir: { activo: true, freqDias: 30, bonusPct: 10, precioTH: 10.14, wthNuevo: 15 }
});
comprobar("con neto negativo el neto diario es < 0", pDef.serieNetoDia[0] < 0, true);
comprobar("reinvirtiendo con pérdidas no se restan TH", pDef.extraTH, 0);
comprobar("la flota final no baja de la inicial", pDef.thFinal, 10);
comprobar("el déficit se conserva en caja (serie = acumulado)",
  pDef.serieRe[pDef.serieRe.length - 1], pDef.acumUSD, 1e-6);

// El precio del BTC creciendo sube el acumulado en USD
const pBull = M.proyectar({ ...baseProy, crecimientoBTCanual: 50 });
comprobar("con BTC +50%/año el acumulado en USD sube", pBull.acumUSD > p0.acumUSD, true);

console.log("\n— Formato español —");
// Convención española: símbolo detrás, miles con punto, decimales con coma
comprobar("miles con punto y decimales con coma", M.fmtU(1234.56), "1.234,56 $");
comprobar("se fuerza el separador también con 4 cifras", M.fmtU(9999), "9.999,00 $");
comprobar("negativos con el signo delante del número", M.fmtU(-1234.56), "-1.234,56 $");
comprobar("importes diarios pequeños con 4 decimales", M.fmtUsdDia(0.1003), "0,1003 $");
comprobar("importes diarios grandes con 2", M.fmtUsdDia(12.5), "12,50 $");
comprobar("BTC con el símbolo detrás", M.fmtBTC(0.00001413), "0,00001413 ₿");
// fmtN sí respeta la regla española de no agrupar 4 cifras
comprobar("los números sueltos no fuerzan agrupado", M.fmtN(1234, 0), "1234");
comprobar("… pero sí agrupan a partir de 5 cifras", M.fmtN(12345, 0), "12.345");
comprobar("hashrate en EH/s", M.fmtHashrate(915331674), "915,33 EH/s");
comprobar("hashrate pequeño en TH/s", M.fmtHashrate(30), "30 TH/s");

console.log("\n" + "=".repeat(46));
console.log(fallos === 0 ? `TODO OK — ${ok} comprobaciones` : `${fallos} FALLOS de ${ok + fallos}`);
console.log("=".repeat(46) + "\n");
process.exit(fallos === 0 ? 0 : 1);
