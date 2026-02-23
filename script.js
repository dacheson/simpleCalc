(function () {
  "use strict";

  // ---- DOM refs ----
  const displayEl = document.getElementById("display");
  const expressionEl = document.getElementById("expression");

  // ---- State ----
  let currentInput = "0";   // what the user is currently typing
  let expression = [];       // array of numbers and operators, e.g. [5, "+", 3]
  let operator = null;       // pending operator after pressing an operator key
  let waitingForOperand = false;
  let justEvaluated = false; // true right after pressing "="

  // ---- Helpers ----
  function updateDisplay() {
    displayEl.textContent = currentInput;
    // Shrink font if text is long
    displayEl.classList.toggle("shrink", currentInput.length > 12);
  }

  function updateExpression(text) {
    expressionEl.textContent = text || "";
  }

  function resetAll() {
    currentInput = "0";
    expression = [];
    operator = null;
    waitingForOperand = false;
    justEvaluated = false;
    updateDisplay();
    updateExpression("");
  }

  function showError() {
    currentInput = "Error";
    updateDisplay();
    updateExpression("");
    expression = [];
    operator = null;
    waitingForOperand = false;
    justEvaluated = false;
    setTimeout(resetAll, 1500);
  }

  /** Safely evaluate a flat expression array [num, op, num, op, num, …]
   *  Respects operator precedence (* / before + -).
   */
  function evaluate(tokens) {
    if (tokens.length === 0) return null;
    // Clone so we don't mutate
    var t = tokens.slice();

    // First pass: * and /
    var i = 1;
    while (i < t.length) {
      if (t[i] === "*" || t[i] === "/") {
        var left = t[i - 1];
        var right = t[i + 1];
        var result;
        if (t[i] === "*") {
          result = left * right;
        } else {
          if (right === 0) return null; // divide by zero
          result = left / right;
        }
        t.splice(i - 1, 3, result);
        // don't increment i — continue at same position
      } else {
        i += 2;
      }
    }

    // Second pass: + and -
    var result = t[0];
    for (i = 1; i < t.length; i += 2) {
      var op = t[i];
      var right = t[i + 1];
      if (op === "+") result += right;
      else if (op === "-") result -= right;
    }
    return result;
  }

  function formatNumber(n) {
    if (!isFinite(n)) return "Error";
    // Avoid floating point artifacts like 0.1+0.2 = 0.30000000000000004
    var str = parseFloat(n.toPrecision(12)).toString();
    // If extremely long, truncate
    if (str.length > 16) {
      str = parseFloat(n).toExponential(6);
    }
    return str;
  }

  function prettyOp(op) {
    switch (op) {
      case "+": return "+";
      case "-": return "−";
      case "*": return "×";
      case "/": return "÷";
      default: return op;
    }
  }

  function buildExpressionString(tokens, includeTrailingOp) {
    var parts = tokens.map(function (t) {
      return typeof t === "number" ? formatNumber(t) : " " + prettyOp(t) + " ";
    });
    var str = parts.join("");
    if (includeTrailingOp && operator) {
      str += " " + prettyOp(operator) + " ";
    }
    return str.trim();
  }

  // ---- Actions ----

  function inputNumber(digit) {
    if (justEvaluated) {
      // Start fresh after pressing =
      expression = [];
      operator = null;
      justEvaluated = false;
      currentInput = digit;
      waitingForOperand = false;
      updateExpression("");
      updateDisplay();
      return;
    }

    if (waitingForOperand) {
      currentInput = digit;
      waitingForOperand = false;
    } else {
      currentInput = currentInput === "0" ? digit : currentInput + digit;
    }
    updateDisplay();
  }

  function inputDecimal() {
    if (justEvaluated) {
      expression = [];
      operator = null;
      justEvaluated = false;
      currentInput = "0.";
      waitingForOperand = false;
      updateExpression("");
      updateDisplay();
      return;
    }

    if (waitingForOperand) {
      currentInput = "0.";
      waitingForOperand = false;
      updateDisplay();
      return;
    }

    if (currentInput.indexOf(".") !== -1) return; // already has decimal
    currentInput += ".";
    updateDisplay();
  }

  function inputOperator(nextOp) {
    var inputValue = parseFloat(currentInput);

    if (justEvaluated) {
      // Continue chaining from the result
      expression = [inputValue];
      operator = nextOp;
      waitingForOperand = true;
      justEvaluated = false;
      updateExpression(buildExpressionString(expression, true));
      return;
    }

    if (operator && waitingForOperand) {
      // Just replace the pending operator
      operator = nextOp;
      // Update expression display to reflect new operator
      updateExpression(buildExpressionString(expression, true));
      return;
    }

    if (operator && !waitingForOperand) {
      // Push operator and operand, but DON'T evaluate yet (chained operations)
      expression.push(operator);
      expression.push(inputValue);
    } else {
      // First operand
      expression = [inputValue];
    }

    operator = nextOp;
    waitingForOperand = true;
    updateExpression(buildExpressionString(expression, true));
  }

  function inputEquals() {
    var inputValue = parseFloat(currentInput);

    if (justEvaluated) return; // pressing = again does nothing

    if (operator && !waitingForOperand) {
      expression.push(operator);
      expression.push(inputValue);
    } else if (!operator) {
      // Just pressing = with a single number
      expression = [inputValue];
    }
    // If waiting for operand (operator pressed, no second number), treat current as operand
    if (operator && waitingForOperand) {
      expression.push(operator);
      expression.push(inputValue);
    }

    var exprStr = buildExpressionString(expression, false) + " =";
    var result = evaluate(expression);

    if (result === null || !isFinite(result)) {
      updateExpression(exprStr);
      showError();
      return;
    }

    currentInput = formatNumber(result);
    operator = null;
    waitingForOperand = false;
    justEvaluated = true;

    updateExpression(exprStr);
    updateDisplay();
  }

  function inputBackspace() {
    if (justEvaluated || currentInput === "Error") {
      resetAll();
      return;
    }
    if (waitingForOperand) return; // nothing to backspace

    if (currentInput.length <= 1 || (currentInput.length === 2 && currentInput[0] === "-")) {
      currentInput = "0";
    } else {
      currentInput = currentInput.slice(0, -1);
    }
    updateDisplay();
  }

  function inputPercent() {
    var value = parseFloat(currentInput);
    if (isNaN(value)) return;
    currentInput = formatNumber(value / 100);
    if (justEvaluated) {
      expression = [];
      operator = null;
      justEvaluated = false;
      updateExpression("");
    }
    updateDisplay();
  }

  function inputToggleSign() {
    if (currentInput === "0" || currentInput === "Error") return;
    if (currentInput[0] === "-") {
      currentInput = currentInput.slice(1);
    } else {
      currentInput = "-" + currentInput;
    }
    if (justEvaluated) {
      expression = [];
      operator = null;
      justEvaluated = false;
      updateExpression("");
    }
    updateDisplay();
  }

  // ---- Button click handler ----
  document.querySelector(".buttons").addEventListener("click", function (e) {
    var btn = e.target.closest(".btn");
    if (!btn) return;

    var action = btn.dataset.action;
    var value = btn.dataset.value;

    switch (action) {
      case "number":    inputNumber(value); break;
      case "decimal":   inputDecimal(); break;
      case "operator":  inputOperator(value); break;
      case "equals":    inputEquals(); break;
      case "clear":     resetAll(); break;
      case "backspace": inputBackspace(); break;
      case "percent":   inputPercent(); break;
      case "toggle-sign": inputToggleSign(); break;
    }
  });

  // ---- Keyboard support ----
  document.addEventListener("keydown", function (e) {
    var key = e.key;

    if (key >= "0" && key <= "9") {
      e.preventDefault();
      inputNumber(key);
    } else if (key === ".") {
      e.preventDefault();
      inputDecimal();
    } else if (key === "+" || key === "-") {
      e.preventDefault();
      inputOperator(key);
    } else if (key === "*") {
      e.preventDefault();
      inputOperator("*");
    } else if (key === "/") {
      e.preventDefault();
      inputOperator("/");
    } else if (key === "Enter" || key === "=") {
      e.preventDefault();
      inputEquals();
    } else if (key === "Backspace") {
      e.preventDefault();
      inputBackspace();
    } else if (key === "Escape") {
      e.preventDefault();
      resetAll();
    } else if (key === "%") {
      e.preventDefault();
      inputPercent();
    }
  });

  // ---- Initial render ----
  updateDisplay();
})();
