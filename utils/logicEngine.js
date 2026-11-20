
const { execFile } = require("child_process");
const path = require("path");

const IS_WINDOWS = process.platform === "win32";

const ENGINE_PATH = process.env.LOGIC_ENGINE_PATH || path.join(
  __dirname,
  "../cpp-engine",
  IS_WINDOWS ? "logic_engine.exe" : "logic_engine"
);

function runLogicEngine(args) {
  return new Promise((resolve, reject) => {
    execFile(
      ENGINE_PATH,
      args,
      {
        timeout: 5000,
        windowsHide: true,
        maxBuffer: 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          return reject(
            new Error(stderr || error.message)
          );
        }

        try {
          const result = JSON.parse(stdout.trim());

          if (!result.success) {
            return reject(new Error("Logic engine failed"));
          }

          resolve(result);
        } catch {
          reject(new Error("Invalid JSON from C++ engine"));
        }
      }
    );
  });
}

module.exports = { runLogicEngine };
