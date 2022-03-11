import React from "react";
import styled from "styled-components";
import { Heading } from "../common/atomic";
import Table from "../common/Table";
import { useAppContext } from "../context/app/appContext";
import { Tick } from "../repos/uniswap";
import bn from "bignumber.js";
import {
  calculateDeltaAndGamma,
  calculateFee,
  getLiquidityForAmounts,
  getSqrtPriceX96,
  getTickFromPrice,
  getTokenAmountsFromDepositAmounts,
} from "../utils/liquidityMath";
import { AppActionType } from "../context/app/appReducer";

const SettingContainer = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 16px;
`;
const Fee = styled.span`
  display: block;
  color: rgb(37, 175, 96);
  font-weight: 500;
  font-size: 2.4rem;
  margin-top: -10px;

  & > span {
    margin-right: 3px;
    display: inline-block;
    font-weight: 600;
    transform: translateY(2px);
  }
`;

const Cost = styled.span`
  display: block;
  color: white;
  font-weight: 500;
  font-size: 1.2rem;
  margin-top: 2px;
`;
const Tag = styled.div`
  display: inline-block;
  color: rgba(255, 255, 255, 0.3);
`;

const FundingRateInput = styled.input`
  display: block;
  width: 100%;
  border: 0;
  background: transparent;
  color: white;
  font-weight: 600;
  font-size: 2rem;

  &:focus {
    outline: none;
  }
`;
const EstimatedFees = () => {
  const { state, dispatch } = useAppContext();

  const calculateLiquidity = (ticks: Tick[], currentTick: number): bn => {
    if (ticks.length <= 1) return new bn(0);
    let liquidity: bn = new bn(0);
    for (let i = 0; i < ticks.length - 1; ++i) {
      liquidity = liquidity.plus(new bn(ticks[i].liquidityNet));

      let lowerTick = Number(ticks[i].tickIdx);
      let upperTick = Number(ticks[i + 1].tickIdx);

      if (lowerTick <= currentTick && currentTick <= upperTick) {
        break;
      }
    }

    return liquidity;
  };

  const P = state.priceAssumptionValue;
  const Pl = state.priceRangeValue[0];
  const Pu = state.priceRangeValue[1];
  const priceUSDX = state.token1PriceChart?.currentPriceUSD || 1;
  const priceUSDY = state.token0PriceChart?.currentPriceUSD || 1;
  const targetAmounts = state.depositAmountValue;

  const { amount0, amount1 } = getTokenAmountsFromDepositAmounts(
    P,
    Pl,
    Pu,
    priceUSDX,
    priceUSDY,
    targetAmounts
  );

  const sqrtRatioX96 = getSqrtPriceX96(
    P,
    state.token0?.decimals || "18",
    state.token1?.decimals || "18"
  );
  const sqrtRatioAX96 = getSqrtPriceX96(
    Pl,
    state.token0?.decimals || "18",
    state.token1?.decimals || "18"
  );
  const sqrtRatioBX96 = getSqrtPriceX96(
    Pu,
    state.token0?.decimals || "18",
    state.token1?.decimals || "18"
  );

  const deltaL = getLiquidityForAmounts(
    sqrtRatioX96,
    sqrtRatioAX96,
    sqrtRatioBX96,
    amount0,
    Number(state.token1?.decimals || 18),
    amount1,
    Number(state.token0?.decimals || 18)
  );

  let currentTick = getTickFromPrice(
    P,
    state.token0?.decimals || "18",
    state.token1?.decimals || "18"
  );

  if (state.isSwap) currentTick = -currentTick;

  const L = calculateLiquidity(state.poolTicks || [], currentTick);
  const volume24H = state.volume24H;
  const feeTier = state.pool?.feeTier || "";

  let fee = calculateFee(deltaL, L, volume24H, feeTier);
  if (P < Pl || P > Pu) fee = 0;

  const deltaAndGamma = calculateDeltaAndGamma(deltaL, P,
    Pl,
    Pu)

  const requiredSqueeth = deltaAndGamma.gamma * 10000 / 2
  const fundingRate = state.fundingRate
  const cost = (P * P / 10000) * fundingRate * requiredSqueeth

  return (
    <SettingContainer>
      <Heading>
        Estimated Fees <Tag>(24h)</Tag>
      </Heading>
      <Fee>
        <span className="dollar">$</span>
        {fee.toFixed(2)}
      </Fee>

      <Table>
        <div>MONTHLY</div>
        <div>${(fee * 30).toFixed(2)}</div>
        <div>{((100 * (fee * 30)) / targetAmounts).toFixed(2)}%</div>
      </Table>
      <Table>
        <div>YEARLY (APR)</div>
        <div>${(fee * 365).toFixed(2)}</div>
        <div>{((100 * (fee * 365)) / targetAmounts).toFixed(2)}%</div>
      </Table>

      <Heading>Squeeth Funding Rate</Heading>

      <FundingRateInput
        value={state.fundingRate}
        type="number"
        placeholder="0.00"
        onChange={(e) => {
          let value = Number(e.target.value);
          if (value < 0) value = 0;

          dispatch({
            type: AppActionType.UPDATE_FUNDING_RATE,
            payload: value,
          });
        }}
      />
      <Cost>LP Position's Gamma: {(Math.floor(deltaAndGamma.gamma * 100000) / 100000).toString()}</Cost>
      <Cost>Required Squeeth: {(Math.floor(requiredSqueeth * 100) / 100).toString()}</Cost>
      <Cost>Funding Cost: ${(Math.floor(cost * 100) / 100).toString()}</Cost>

    </SettingContainer>
  );
};

export default EstimatedFees;
