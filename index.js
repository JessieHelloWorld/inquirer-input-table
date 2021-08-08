const chalk = require("chalk");
const cliCursor = require("cli-cursor");
const Base = require("inquirer/lib/prompts/base");
const Choices = require("inquirer/lib/objects/choices");
const observe = require("inquirer/lib/utils/events");
const Table = require("cli-table");
const {
  map
} = require("rxjs/operators");

class TablePrompt extends Base {
  /**
   * Initialise the prompt
   *
   * @param  {Object} questions
   * @param  {Object} rl
   * @param  {Object} answers
   */
  constructor(questions, rl, answers) {
    super(questions, rl, answers);

    this.columns = new Choices(this.opt.columns, []);
    this.rows = new Choices(this.opt.rows, []);
    this.row = 0
    this.column = 0
    this.values = []

    this.pageSize = this.opt.pageSize || 5;
  }

  /**
   * Start the inquirer session
   *
   * @param  {Function} callback
   * @return {TablePrompt}
   */
  _run(callback) {
    this.done = callback;

    const events = observe(this.rl);
    const validation = this.handleSubmitEvents(
      events.line.pipe(map(this.getCurrentValue.bind(this)))
    );
    validation.success.forEach(this.onEnd.bind(this));
    validation.error.forEach(this.onError.bind(this));

    events.keypress.forEach(({
      key,
      value
    }) => {
      switch (key.name) {
        case "left":
          return this.onLeftKey();
        case "right":
          return this.onRightKey();
        case "up":
          return this.onUpKey()
        case "down":
          return this.onDownKey()
        case "backspace":
          return this.handleDelete()

        default:
          return this.handleInput(value)
      }
    });

    if (this.rl.line) {
      this.onKeypress();
    }

    cliCursor.hide();
    this.render();

    return this;
  }

  getCurrentValue() {
    // return an object like key-value 
    return this.dimen2ArrToObj(this.values);
  }

  /**
   * 
   * @param {*} dimenArr Two-dimensional array
   * @returns { [rowName_columnName]: value }
   */
  dimen2ArrToObj(dimenArr) {
    let obj = {}
    const rowNames = this.rows.pluck("name")
    const columnNames = this.columns.pluck("name")
    rowNames.forEach((rowName, rowIndex) => {
      columnNames.forEach((columnName, columnIndex) => {
        obj[`${rowName}_${columnName}`] = dimenArr && dimenArr[rowIndex] && dimenArr[rowIndex][columnIndex] || ''
      })
    })
    return obj
  }

  onDownKey() {
    const length = this.rows.realLength;
    this.row = this.row < length - 1 ? this.row + 1 : this.row;
    this.render();
  }

  onEnd(state) {
    this.render();
    this.screen.done();
    cliCursor.show();
    this.done(state.value);
  }

  onError(state) {
    this.render(state.isValid);
  }

  onLeftKey() {
    const length = this.columns.realLength;

    this.column =
      this.column > 0 ? this.column - 1 : length - 1;

    this.render();
  }

  onRightKey() {
    const length = this.columns.realLength;

    this.column =
      this.column < length - 1 ? this.column + 1 : 0;
    this.render();
  }

  onUpKey() {
    this.row = this.row > 0 ? this.row - 1 : this.row;
    this.render();
  }

  handleInput(value) {
    if (!this.values[this.row]) {
      this.values[this.row] = []
      this.values[this.row][this.column] = `${value}`
    } else {
      this.values[this.row][this.column] = (this.values[this.row][this.column] || '') + value
    }
    this.render()
  }

  handleDelete() {
    if (this.values[this.row] && this.values[this.row][this.column] && this.values[this.row][this.column].length > 0) {
      this.values[this.row][this.column] = this.values[this.row][this.column].substring(0, this.values[this.row][this.column].length - 1)
    }
    this.render()
  }

  paginate() {
    const middleOfPage = Math.floor(this.pageSize / 2);
    const firstIndex = Math.max(0, this.row - middleOfPage);
    const lastIndex = Math.min(
      firstIndex + this.pageSize - 1,
      this.rows.realLength - 1
    );
    const lastPageOffset = this.pageSize - 1 - lastIndex + firstIndex;

    return [Math.max(0, firstIndex - lastPageOffset), lastIndex];
  }

  render(error) {
    let message = this.getQuestion();
    let bottomContent = "";

    message +=
      "(Press " +
      chalk.cyan.bold("<enter>") +
      " to submit, " +
      chalk.cyan.bold("<Up and Down>") +
      " to move rows, " +
      chalk.cyan.bold("<Left and Right>") +
      " to move columns)";

    const [firstIndex, lastIndex] = this.paginate();
    const table = new Table({
      head: [
        chalk.reset.dim(
          `${firstIndex + 1}-${lastIndex + 1} of ${this.rows.realLength}`
        )
      ].concat(this.columns.pluck("name").map((name, index) => {
        if (index === this.column) {
          return chalk.reset.bold.cyan(name)
        } else {
          return chalk.reset.bold(name)
        }
      }))

    });

    this.rows.forEach((row, rowIndex) => {
      if (rowIndex < firstIndex || rowIndex > lastIndex) return;

      const columnValues = [];

      this.columns.forEach((column, columnIndex) => {
        const isSelected =
          this.row === rowIndex &&
          this.column === columnIndex;
        const value = this.values[rowIndex] && this.values[rowIndex][columnIndex] || ''

        columnValues.push(
          `${isSelected ? "[" : " "} ${value} ${isSelected ? "]" : " "}`
        );
      });

      const chalkModifier =
        this.row === rowIndex ?
        chalk.reset.bold.cyan :
        chalk.reset;

      table.push({
        [chalkModifier(row.name)]: columnValues
      });
    });

    message += "\n\n" + table.toString();
    if (error) {
      bottomContent = chalk.red(">> ") + error;
    }
    this.screen.render(message, bottomContent);
  }
}

module.exports = TablePrompt;