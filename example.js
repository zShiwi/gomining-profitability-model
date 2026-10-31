#!/usr/bin/env node
"use strict";
/*
 * example.js — what a GoMining miner nets today, with live network data.
 *
 *   node example.js                 # 100 TH at 12 W/TH, no discounts
 *   node example.js 250 15          # 250 TH at 15 W/TH
 *
 * Needs Node 18+ (built-in fetch). No dependencies.
 */
require("./motor.js");
const M = globalThis.MotorGoMining;
M.setIdioma("en");

const usd = (x, d = 2) => (x < 0 ? "-$" : "$") + Math.abs(x).toFixed(d);
const th = Number(process.argv[2]) || 100;
const wth = Number(process.argv[3]) || 12;

(async () => {
  const [prices, network] = await Promise.all([M.traerPrecios(null), M.traerRed(null)]);

  const settings = {
    modoSatTH: "red",                         // derive sats/TH/day from the live network
    factorPool: M.CONST.FACTOR_POOL_DEFECTO,  // 0.995: share of the network reward GoMining pays
    kwh: M.CONST.KWH_DEFECTO,                 // $0.05 per kWh
    saldoGMT: 0, vip: 0, racha: 0, descSolo: 0, // no maintenance discounts
    cap: M.CONST.CAP_DESCUENTO_DEFECTO,
    proteccion: false
  };
  const fleet = [{ id: "a", nombre: "miner", th, wth, precio: 0, modo: "solo" }];
  const r = M.calcularFlota(fleet, settings, prices.btc, prices.gmt, network);

  const satsPerTH = r.satTH.satTH;
  const maintenance = r.tot.mant;
  const breakEven = maintenance / (satsPerTH * th / 1e8);

  console.log(`\n${th} TH at ${wth} W/TH, electricity $${settings.kwh}/kWh, no discounts`);
  console.log(`Bitcoin $${prices.btc.toLocaleString("en-US")} · network ${M.fmtHashrate(network.hashrateTH)}${prices.esFallback || network.esFallback ? " (fallback values)" : ""}\n`);
  console.log(`  Mined per TH a day   ${satsPerTH.toFixed(2)} sats`);
  console.log(`  Gross per day        ${usd(r.tot.brutoUSD)}`);
  console.log(`  Maintenance per day  ${usd(maintenance)}`);
  console.log(`  Net per day          ${usd(r.tot.netoReal)}`);
  console.log(`  Break-even BTC price $${Math.round(breakEven).toLocaleString("en-US")}\n`);
})().catch(e => { console.error(e); process.exit(1); });
