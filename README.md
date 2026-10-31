# GoMining profitability model

The open calculation engine behind **[gominingcalc.com](https://gominingcalc.com/)**, an unofficial GoMining calculator. One dependency-free JavaScript file that works out what a GoMining digital miner really earns: the bitcoin it mines, minus electricity and service fee, after maintenance discounts, with the 2028 halving included.

Every constant in [`motor.js`](motor.js) carries its source and the date it was checked. The code comments are in Spanish; this README explains the model in English.

> **Unofficial.** Not affiliated with, endorsed or sponsored by GoMining. Results are estimates on assumptions you can change, they can be negative, and nothing here is financial advice.

**Try it in the browser:** [GoMining Calculator on Hugging Face](https://huggingface.co/spaces/zshiwo/gomining-calculator), or the full version at [gominingcalc.com](https://gominingcalc.com/).

## Quick start

```bash
node example.js            # 100 TH at 12 W/TH, live network data
node example.js 250 15     # 250 TH at 15 W/TH
node motor.test.js         # 70 checks, no dependencies
```

Output on 31 October 2026:

```
100 TH at 12 W/TH, electricity $0.05/kWh, no discounts
Bitcoin $77,197 · network 1,062.03 EH/s

  Mined per TH a day   42.46 sats
  Gross per day        $3.28
  Maintenance per day  $2.33
  Net per day          $0.95
  Break-even BTC price $54,876
```

In a browser it's a classic script (no build, it even works from `file://`):

```html
<script src="motor.js"></script>
<script>
  const M = globalThis.MotorGoMining;
  // M.calcularFlota(miners, settings, btcPrice, gominingTokenPrice, network)
</script>
```

## The model, step by step

### 1. What the network pays per TH

Bitcoin issues a block about every 10 minutes, 144 a day. Each block pays the subsidy (3.125 BTC until the 2028 halving) plus the transaction fees. Every TH gets an equal share:

```
sats per TH per day (network) = 144 × (subsidy + average fees per block) ÷ network hashrate in TH
subsidy                       = 50 ÷ 2^floor(block height ÷ 210,000)   BTC
```

The hashrate is derived from the difficulty (`difficulty × 2^32 ÷ 600`), and the price, hashrate, block height and fees are read live from CoinGecko and mempool.space.

### 2. What GoMining actually pays: the pool factor

```
sats per TH per day (paid) = network figure × 0.995
```

That 0.995 isn't in any official document. It comes from comparing 30 days of payouts exported from a real account (10 September – 10 October 2026, a 96 TH miner) with the reward the network actually issued on each of those days: **99.6%**, rounded down to 99.5%. The full working is on the [methodology page](https://gominingcalc.com/methodology).

### 3. The maintenance bill

Two lines, both from GoMining's documentation:

```
electricity per day = W/TH × TH × $/kWh × 24 ÷ 1000      ($/kWh between 0.05 and 0.07)
service per day     = $0.0089 × TH
```

A 12 W/TH miner at $0.05/kWh costs $0.0233 per TH a day: $2.33 for 100 TH.

### 4. Maintenance discounts

| Discount | How it's earned | Up to |
|---|---|---|
| GOMINING token | 1 point per 18 days of maintenance your token balance covers | 20% |
| VIP level | Automatic, by TH held or veGOMINING votes | 6% |
| Service button | 0.3% per consecutive day | 3% |

The three documented discounts add up to 29%. The model caps them there; the solo-mining discount set by the weekly veGOMINING vote is an optional input because it has no fixed value. Details: [the discount ladder](https://gominingcalc.com/blog/gomining-token-vip-and-maintenance-discounts).

### 5. Net and break-even

```
net per day      = paid sats × TH ÷ 10^8 × BTC price − maintenance × (1 − discount)
break-even price = maintenance per day ÷ BTC mined per day
```

The break-even price is the bitcoin price below which the miner loses money every day. It's the single most useful number in the model, and it's why efficiency matters: on the 31 October 2026 network, a 12 W/TH miner breaks even at about $54,900 and a 20 W/TH one at about $77,500.

### 6. Projections

`proyectar()` runs the same sum day by day for up to 24 months, growing the network difficulty at a monthly rate you choose and applying the halving at block 1,050,000 (expected around April 2028), when the subsidy drops to 1.5625 BTC.

## Data

The same engine produces the **[GoMining profitability index](https://gominingcalc.com/blog/gomining-profitability-index)**: what each TH paid and kept every month since November 2023, and the break-even price, refreshed monthly. Download it as [CSV](https://gominingcalc.com/blog/indice-rentabilidad-gomining.csv) (CC BY 4.0).

## Use it online

- [GoMining calculator](https://gominingcalc.com/): your miner, discounts and a 24-month projection
- [Efficiency upgrade calculator](https://gominingcalc.com/blog/gomining-efficiency-upgrade-calculator): is lowering your W/TH worth it?
- [Break-even price of each miner](https://gominingcalc.com/blog/gomining-break-even-price)
- Also in [Spanish](https://gominingcalc.com/es), [French](https://gominingcalc.com/fr) and [Portuguese](https://gominingcalc.com/pt)

## Licence

Code under the [MIT licence](LICENSE). If GoMining changes a rate, open an issue with the source and the constant gets updated, with its date.
