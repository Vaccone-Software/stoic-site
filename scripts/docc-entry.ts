// Exposes the plate renderer to the page the DocC plate script drives.
import * as plates from "../lib/plates";
(window as unknown as { plates: typeof plates }).plates = plates;
