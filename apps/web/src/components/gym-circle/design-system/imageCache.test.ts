import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearImageCache,
  getCacheSize,
  getPreloadCount,
  hasImageLoaded,
  markImageLoaded,
  pinSource,
  preloadImage,
  preloadImages,
  unpinSource,
} from "./imageCache";

describe("imageCache — Sprint 2.1", () => {
  beforeEach(() => {
    clearImageCache();
  });

  describe("markImageLoaded + hasImageLoaded", () => {
    it("marca e detecta src como loaded", () => {
      expect(hasImageLoaded("https://example.com/a.jpg")).toBe(false);
      markImageLoaded("https://example.com/a.jpg");
      expect(hasImageLoaded("https://example.com/a.jpg")).toBe(true);
    });

    it("é idempotente — marcar 2x não duplica", () => {
      markImageLoaded("a");
      markImageLoaded("a");
      expect(getCacheSize()).toBe(1);
    });

    it("ignora src vazio (defensivo)", () => {
      markImageLoaded("");
      expect(getCacheSize()).toBe(0);
      expect(hasImageLoaded("")).toBe(false);
    });

    it("trata sources distintos independentemente", () => {
      markImageLoaded("a");
      markImageLoaded("b");
      expect(hasImageLoaded("a")).toBe(true);
      expect(hasImageLoaded("b")).toBe(true);
      expect(hasImageLoaded("c")).toBe(false);
      expect(getCacheSize()).toBe(2);
    });
  });

  describe("clearImageCache", () => {
    it("zera o Set — usado no logout pra evitar vazamento entre users", () => {
      markImageLoaded("avatar-user-a");
      markImageLoaded("post-user-a");
      expect(getCacheSize()).toBe(2);
      clearImageCache();
      expect(getCacheSize()).toBe(0);
      expect(hasImageLoaded("avatar-user-a")).toBe(false);
    });
  });

  describe("preloadImage", () => {
    // Mock global Image — vitest jsdom traz uma versão básica, mas o
    // método `.decode()` não existe nela. Polyfill manual.
    beforeEach(() => {
      class FakeImage {
        src = "";
        decoding = "auto";
        complete = false;
        naturalWidth = 0;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        decode() {
          // Simula decode bem-sucedido no próximo tick.
          return new Promise<void>((resolve) => {
            setTimeout(() => {
              this.complete = true;
              this.naturalWidth = 100;
              resolve();
            }, 0);
          });
        }
      }
      vi.stubGlobal("Image", FakeImage);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("resolve imediatamente quando src já está no cache", async () => {
      markImageLoaded("cached.jpg");
      const start = Date.now();
      await preloadImage("cached.jpg");
      // Deve ser síncrono — < 5ms é generoso pra Promise.resolve().
      expect(Date.now() - start).toBeLessThan(5);
    });

    it("ignora src vazio (resolve imediato)", async () => {
      await expect(preloadImage("")).resolves.toBeUndefined();
      expect(getCacheSize()).toBe(0);
    });

    it("marca como loaded após decode bem-sucedido", async () => {
      expect(hasImageLoaded("new.jpg")).toBe(false);
      await preloadImage("new.jpg");
      expect(hasImageLoaded("new.jpg")).toBe(true);
    });

    it("é idempotente — chamadas paralelas compartilham a mesma Promise", async () => {
      const p1 = preloadImage("parallel.jpg");
      const p2 = preloadImage("parallel.jpg");
      // Mesma referência de Promise (otimização do `pendingPreloads` Map).
      expect(p1).toBe(p2);
      await Promise.all([p1, p2]);
      expect(hasImageLoaded("parallel.jpg")).toBe(true);
    });
  });

  describe("preloadImages", () => {
    beforeEach(() => {
      class FakeImage {
        src = "";
        decoding = "auto";
        decode() {
          return Promise.resolve();
        }
      }
      vi.stubGlobal("Image", FakeImage);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("carrega múltiplos srcs e marca todos como loaded", async () => {
      const srcs = ["a.jpg", "b.jpg", "c.jpg"];
      await preloadImages(srcs);
      for (const src of srcs) {
        expect(hasImageLoaded(src)).toBe(true);
      }
    });

    it("filtra srcs vazios sem quebrar", async () => {
      await preloadImages(["a.jpg", "", "b.jpg"]);
      expect(hasImageLoaded("a.jpg")).toBe(true);
      expect(hasImageLoaded("b.jpg")).toBe(true);
      expect(hasImageLoaded("")).toBe(false);
    });

    it("respeita concurrency mínima de 1 quando passado 0", async () => {
      // Não quebra, apenas processa serialmente.
      await preloadImages(["x.jpg"], 0);
      expect(hasImageLoaded("x.jpg")).toBe(true);
    });
  });

  describe("getPreloadCount — connection-aware", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("retorna defaultCount quando navigator.connection não existe (Safari/iOS)", () => {
      vi.stubGlobal("navigator", { userAgent: "test" });
      expect(getPreloadCount(3)).toBe(3);
    });

    it("retorna defaultCount em 4g/wifi", () => {
      vi.stubGlobal("navigator", {
        connection: { effectiveType: "4g", saveData: false },
      });
      expect(getPreloadCount(3)).toBe(3);
    });

    it("retorna metade do default em 3g", () => {
      vi.stubGlobal("navigator", {
        connection: { effectiveType: "3g", saveData: false },
      });
      expect(getPreloadCount(4)).toBe(2);
      expect(getPreloadCount(3)).toBe(1); // Math.floor(3/2) = 1
    });

    it("retorna 1 em 2g/slow-2g (mínimo)", () => {
      vi.stubGlobal("navigator", {
        connection: { effectiveType: "slow-2g", saveData: false },
      });
      expect(getPreloadCount(3)).toBe(1);
      vi.stubGlobal("navigator", {
        connection: { effectiveType: "2g", saveData: false },
      });
      expect(getPreloadCount(3)).toBe(1);
    });

    it("retorna 1 quando saveData=true (independente do effectiveType)", () => {
      vi.stubGlobal("navigator", {
        connection: { effectiveType: "4g", saveData: true },
      });
      expect(getPreloadCount(3)).toBe(1);
    });

    it("retorna 0 quando defaultCount=0", () => {
      vi.stubGlobal("navigator", {
        connection: { effectiveType: "4g" },
      });
      expect(getPreloadCount(0)).toBe(0);
    });
  });

  describe("imageCache LRU integration", () => {
    it("evicts oldest when capacity exceeded", () => {
      clearImageCache();
      for (let i = 0; i < 155; i++) {
        markImageLoaded(`https://example.com/${i}.jpg`);
      }
      expect(hasImageLoaded("https://example.com/0.jpg")).toBe(false);
      expect(hasImageLoaded("https://example.com/4.jpg")).toBe(false);
      expect(hasImageLoaded("https://example.com/5.jpg")).toBe(true);
      expect(hasImageLoaded("https://example.com/154.jpg")).toBe(true);
    });

    it("pinSource protege from eviction", () => {
      clearImageCache();
      markImageLoaded("https://example.com/pinned.jpg");
      pinSource("https://example.com/pinned.jpg");
      for (let i = 0; i < 160; i++) {
        markImageLoaded(`https://example.com/${i}.jpg`);
      }
      expect(hasImageLoaded("https://example.com/pinned.jpg")).toBe(true);
    });

    it("unpinSource permite eviction normal", () => {
      clearImageCache();
      markImageLoaded("https://example.com/temp.jpg");
      pinSource("https://example.com/temp.jpg");
      unpinSource("https://example.com/temp.jpg");
      for (let i = 0; i < 160; i++) {
        markImageLoaded(`https://example.com/${i}.jpg`);
      }
      expect(hasImageLoaded("https://example.com/temp.jpg")).toBe(false);
    });

    it("getCacheSize cap em capacity", () => {
      clearImageCache();
      for (let i = 0; i < 200; i++) {
        markImageLoaded(`https://example.com/${i}.jpg`);
      }
      expect(getCacheSize()).toBe(150);
    });
  });
});
