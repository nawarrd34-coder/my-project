import path from "path";
import { downloadWhisperModel, installWhisperCpp } from "@remotion/install-whisper-cpp";
const to = path.join(process.cwd(), "whisper.cpp");
await installWhisperCpp({ to, version: "1.5.5" });
await downloadWhisperModel({ model: "medium", folder: to });
console.log("done");
