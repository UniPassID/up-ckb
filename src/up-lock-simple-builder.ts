import {
  Address,
  Amount,
  AmountUnit,
  Builder,
  BuilderOption,
  Cell,
  Provider,
  RawTransaction,
  Transaction,
} from '@lay2/pw-core';

export class UPLockSimpleBuilder extends Builder {
  constructor(
    private readonly address: Address,
    private readonly amount: Amount,
    protected readonly provider: Provider,
    protected readonly options: BuilderOption = {}
  ) {
    super(options.feeRate, options.collector, options.witnessArgs);
  }

  async build(fee: Amount = Amount.ZERO): Promise<Transaction> {
    const outputCell = new Cell(this.amount, this.address.toLockScript());

    const data = this.options.data;
    if (data) {
      if (data.startsWith('0x')) {
        outputCell.setHexData(data);
      } else {
        outputCell.setData(data);
      }
    }

    const neededAmount = this.amount.add(Builder.MIN_CHANGE).add(fee);
    let inputSum = new Amount('0');
    const inputCells = [];

    // fill the inputs
    const cells = await this.collector.collect(this.provider.address, {
      neededAmount,
    });
    for (const cell of cells) {
      inputCells.push(cell);
      inputSum = inputSum.add(cell.capacity);
      if (inputSum.gt(neededAmount)) break;
    }

    if (inputSum.lt(neededAmount)) {
      throw new Error(
        `input capacity not enough, need ${neededAmount.toString(
          AmountUnit.ckb
        )}, got ${inputSum.toString(AmountUnit.ckb)}`
      );
    }

    const changeCell = new Cell(
      inputSum.sub(outputCell.capacity),
      this.provider.address.toLockScript()
    );

    const tx = new Transaction(
      new RawTransaction(inputCells, [outputCell, changeCell], []),
      [this.witnessArgs]
    );

    // Note: due to transaction will be complete after building, we can not get accurate tx size here.
    // so we add additional 100000 shannon fee for the transaction
    this.fee = Builder.calcFee(tx, this.feeRate).add(
      new Amount('100000', AmountUnit.shannon)
    );

    if (changeCell.capacity.gte(Builder.MIN_CHANGE.add(this.fee))) {
      changeCell.capacity = changeCell.capacity.sub(this.fee).sub(fee);
      tx.raw.outputs.pop();
      tx.raw.outputs.push(changeCell);
      return tx;
    }

    return this.build(this.fee);
  }

  getCollector() {
    return this.collector;
  }
}
