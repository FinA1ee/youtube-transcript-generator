module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "subject-case": [0],
    "subject-empty": [2, "never"],
    "type-enum": [2, "always", ["build", "chore", "ci", "docs", "feat", "fix", "refactor", "test"]]
  }
};
