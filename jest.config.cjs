module.exports = {
  preset: "jest-expo",
  testMatch: ["**/tests/**/*.ui.test.tsx"],
  modulePathIgnorePatterns: ["[/\\\\]\\._"],
  moduleNameMapper: {
    "^lucide-react-native$":
      "<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js",
  },
  clearMocks: true,
};
