import { render } from "preact";
import App from "./App";

// Mount Preact UI
const host = document.createElement("div");
host.id = "mypack-plus-plus-root";
document.body.appendChild(host);

render(<App />, host);
