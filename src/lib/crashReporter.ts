/**
 * Temporary debugging aid -- see supabase/migrations/0009_crash_reports.sql
 * for why this exists (this build's first real device test crashes on
 * launch with no adb/USB/Wi-Fi access on-device to capture a log). Reports
 * both JS-level uncaught exceptions and native (Java) uncaught exceptions
 * straight to the crash_reports table over the phone's normal internet
 * connection, so the crash can be read back from the Supabase dashboard.
 *
 * Best-effort only: a crash that happens before the JS bridge finishes
 * initializing (a very early native failure) won't reach either handler
 * below, since both are registered from JS. An empty crash_reports table
 * after a reproduced crash is itself a useful data point -- it means the
 * failure is that early, not a JS or reachable-native exception.
 *
 * Safe to delete (along with the migration and this import) once the
 * native build is confirmed stable -- not part of the app's real feature
 * set.
 */
import {
  setJSExceptionHandler,
  setNativeExceptionHandler,
} from "react-native-exception-handler";
import { supabase } from "./supabase";

function report(message: string, stack: string, isFatal: boolean) {
  // Fire-and-forget: a crash handler can't block on a promise for long
  // (native handlers in particular are expected to return quickly), and
  // there's nothing useful to do with an insert failure here anyway.
  supabase
    .from("crash_reports")
    .insert({ platform: "android", message, stack, is_fatal: isFatal })
    .then(
      () => {},
      () => {}
    );
}

export function installCrashReporter() {
  setJSExceptionHandler((error, isFatal) => {
    report(error?.message ?? String(error), error?.stack ?? "", isFatal);
  }, true);

  setNativeExceptionHandler((errorString) => {
    report(errorString, "", true);
  });
}
