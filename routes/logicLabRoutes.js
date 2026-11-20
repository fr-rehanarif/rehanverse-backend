
const express = require("express");
const router = express.Router();

const { runLogicEngine } = require("../utils/logicEngine");

const VALID_GATES = [
  "AND", "OR", "NOT", "NAND",
  "NOR", "XOR", "XNOR"
];

router.post("/evaluate", async (req, res) => {
  try {
    const { gate, a, b } = req.body;

    if (!VALID_GATES.includes(gate) ||
        ![0, 1].includes(a) ||
        (gate !== "NOT" && ![0, 1].includes(b))) {
      return res.status(400).json({
        success: false,
        message: "Invalid gate or inputs"
      });
    }

    const args = gate === "NOT"
      ? ["evaluate", gate, String(a)]
      : ["evaluate", gate, String(a), String(b)];

    const result = await runLogicEngine(args);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get("/truth-table/:gate", async (req, res) => {
  try {
    const gate = req.params.gate.toUpperCase();

    if (!VALID_GATES.includes(gate)) {
      return res.status(400).json({
        success: false,
        message: "Invalid gate"
      });
    }

    const result = await runLogicEngine([
      "truth-table",
      gate
    ]);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post("/half-adder", async (req, res) => {
  try {
    const { a, b } = req.body;

    if (![0, 1].includes(a) || ![0, 1].includes(b)) {
      return res.status(400).json({
        success: false,
        message: "Inputs must be 0 or 1"
      });
    }

    const result = await runLogicEngine([
      "half-adder", String(a), String(b)
    ]);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post("/full-adder", async (req, res) => {
  try {
    const { a, b, carryIn } = req.body;

    if (![0, 1].includes(a) ||
        ![0, 1].includes(b) ||
        ![0, 1].includes(carryIn)) {
      return res.status(400).json({
        success: false,
        message: "Inputs must be 0 or 1"
      });
    }

    const result = await runLogicEngine([
      "full-adder",
      String(a),
      String(b),
      String(carryIn)
    ]);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
