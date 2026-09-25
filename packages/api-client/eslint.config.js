import { reactLibraryConfig } from "@mockprep/config/eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default [...reactLibraryConfig(), reactHooks.configs["recommended-latest"]];
