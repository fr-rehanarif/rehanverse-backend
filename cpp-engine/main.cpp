#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>

// REHANVERSE Logic Lab - C++17 digital logic engine
// Input is supplied through command-line arguments by the Node.js backend.

class LogicGate {
public:
    virtual ~LogicGate() = default;
    virtual bool evaluate(bool a, bool b) const = 0;
    virtual std::string name() const = 0;
    virtual std::string expression() const = 0;
};

class AndGate final : public LogicGate {
public:
    bool evaluate(bool a, bool b) const override { return a && b; }
    std::string name() const override { return "AND"; }
    std::string expression() const override { return "A AND B"; }
};

class OrGate final : public LogicGate {
public:
    bool evaluate(bool a, bool b) const override { return a || b; }
    std::string name() const override { return "OR"; }
    std::string expression() const override { return "A OR B"; }
};

class NandGate final : public LogicGate {
public:
    bool evaluate(bool a, bool b) const override { return !(a && b); }
    std::string name() const override { return "NAND"; }
    std::string expression() const override { return "NOT (A AND B)"; }
};

class NorGate final : public LogicGate {
public:
    bool evaluate(bool a, bool b) const override { return !(a || b); }
    std::string name() const override { return "NOR"; }
    std::string expression() const override { return "NOT (A OR B)"; }
};

class XorGate final : public LogicGate {
public:
    bool evaluate(bool a, bool b) const override { return a != b; }
    std::string name() const override { return "XOR"; }
    std::string expression() const override { return "A XOR B"; }
};

class XnorGate final : public LogicGate {
public:
    bool evaluate(bool a, bool b) const override { return a == b; }
    std::string name() const override { return "XNOR"; }
    std::string expression() const override { return "NOT (A XOR B)"; }
};

class NotGate {
public:
    bool evaluate(bool a) const { return !a; }
    std::string expression() const { return "NOT A"; }
};

class GateFactory {
public:
    static std::unique_ptr<LogicGate> create(const std::string& gateName) {
        if (gateName == "AND") return std::make_unique<AndGate>();
        if (gateName == "OR") return std::make_unique<OrGate>();
        if (gateName == "NAND") return std::make_unique<NandGate>();
        if (gateName == "NOR") return std::make_unique<NorGate>();
        if (gateName == "XOR") return std::make_unique<XorGate>();
        if (gateName == "XNOR") return std::make_unique<XnorGate>();
        throw std::invalid_argument("Unsupported gate. Use AND, OR, NAND, NOR, XOR or XNOR.");
    }
};

bool parseBit(const std::string& value, const std::string& label) {
    if (value == "0") return false;
    if (value == "1") return true;
    throw std::invalid_argument(label + " must be 0 or 1.");
}

void printEvaluate(const std::string& gateName, bool a, bool b) {
    auto gate = GateFactory::create(gateName);
    const bool output = gate->evaluate(a, b);
    std::cout << "{\"success\":true,\"mode\":\"evaluate\",\"gate\":\"" << gate->name()
              << "\",\"expression\":\"" << gate->expression() << "\",\"a\":" << a
              << ",\"b\":" << b << ",\"output\":" << output << "}";
}

void printTruthTable(const std::string& gateName) {
    auto gate = GateFactory::create(gateName);
    std::cout << "{\"success\":true,\"mode\":\"truthTable\",\"gate\":\"" << gate->name()
              << "\",\"expression\":\"" << gate->expression() << "\",\"rows\":[";
    bool first = true;
    for (int a = 0; a <= 1; ++a) {
        for (int b = 0; b <= 1; ++b) {
            if (!first) std::cout << ",";
            first = false;
            std::cout << "{\"a\":" << a << ",\"b\":" << b
                      << ",\"output\":" << gate->evaluate(a, b) << "}";
        }
    }
    std::cout << "]}";
}

void printHalfAdder(bool a, bool b) {
    const bool sum = a != b;       // XOR
    const bool carry = a && b;    // AND
    std::cout << "{\"success\":true,\"mode\":\"halfAdder\",\"a\":" << a
              << ",\"b\":" << b
              << ",\"xor1\":" << sum
              << ",\"and1\":" << carry
              << ",\"sum\":" << sum
              << ",\"carry\":" << carry << "}";
}

void printFullAdder(bool a, bool b, bool carryIn) {
    // Full-adder implementation using two XOR gates, two AND gates and one OR gate.
    const bool xor1 = a != b;             // P = A XOR B
    const bool and1 = a && b;             // G = A AND B
    const bool xor2 = xor1 != carryIn;    // SUM = P XOR Carry-in
    const bool and2 = xor1 && carryIn;    // H = P AND Carry-in
    const bool or1 = and1 || and2;        // Carry-out = G OR H

    std::cout << "{\"success\":true,\"mode\":\"fullAdder\",\"a\":" << a
              << ",\"b\":" << b << ",\"carryIn\":" << carryIn
              << ",\"xor1\":" << xor1
              << ",\"and1\":" << and1
              << ",\"xor2\":" << xor2
              << ",\"and2\":" << and2
              << ",\"or1\":" << or1
              << ",\"sum\":" << xor2
              << ",\"carryOut\":" << or1 << "}";
}

int main(int argc, char* argv[]) {
    try {
        if (argc < 2) {
            throw std::invalid_argument(
                "Usage: logic_engine evaluate <GATE> <A> <B> | truth-table <GATE> | not <A> | half-adder <A> <B> | full-adder <A> <B> <CIN>");
        }

        const std::string mode = argv[1];
        if (mode == "evaluate" && argc == 5) {
            printEvaluate(argv[2], parseBit(argv[3], "A"), parseBit(argv[4], "B"));
        } else if (mode == "truth-table" && argc == 3) {
            printTruthTable(argv[2]);
        } else if (mode == "not" && argc == 3) {
            const bool a = parseBit(argv[2], "A");
            NotGate gate;
            std::cout << "{\"success\":true,\"mode\":\"not\",\"a\":" << a
                      << ",\"output\":" << gate.evaluate(a) << "}";
        } else if (mode == "half-adder" && argc == 4) {
            printHalfAdder(parseBit(argv[2], "A"), parseBit(argv[3], "B"));
        } else if (mode == "full-adder" && argc == 5) {
            printFullAdder(parseBit(argv[2], "A"), parseBit(argv[3], "B"), parseBit(argv[4], "Carry-in"));
        } else {
            throw std::invalid_argument("Invalid command or argument count. Check the Logic Lab command format.");
        }
    } catch (const std::exception& error) {
        std::cout << "{\"success\":false,\"error\":\"" << error.what() << "\"}";
        return 1;
    }
    return 0;
}
