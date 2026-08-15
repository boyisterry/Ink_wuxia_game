import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function render(pathname) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function loadEnemyDemoModule() {
  const configUrl = new URL("../app/combat/enemy-demo.ts", import.meta.url);
  const source = readFileSync(configUrl, "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: configUrl.pathname,
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
  );
}

async function loadGatePhysicsModule() {
  const moduleUrl = new URL("../app/gate-physics.ts", import.meta.url);
  const source = readFileSync(moduleUrl, "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: moduleUrl.pathname,
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
  );
}

test("gate stair walls block from below but release above the tread", async () => {
  const { clampGateSolidWall, GATE_WALL_COLLISION: options } =
    await loadGatePhysicsModule();
  const firstStep = {
    x: 520,
    y: 520,
    w: 240,
    h: 421,
    kind: "solid",
    requiresJump: true,
  };

  assert.ok(
    Math.abs(
      clampGateSolidWall([firstStep], 489.99, 500, 590, options) - 489.99,
    ) < 0.0001,
    "grounded movement must stop the capsule before the riser",
  );
  assert.ok(
    Math.abs(
      clampGateSolidWall([firstStep], 489.99, 500, 550, options) - 489.99,
    ) < 0.0001,
    "air control below the tread must not enter the retaining wall",
  );
  assert.equal(
    clampGateSolidWall([firstStep], 489.99, 500, 510, options),
    null,
    "a jump that raises the feet above the tread may pass and land",
  );
});

test("descending left across jump stairs never collides with the lower tread wall", async () => {
  const { clampGateSolidWall, GATE_WALL_COLLISION: options } =
    await loadGatePhysicsModule();
  const lowerStep = {
    x: 520,
    y: 520,
    w: 240,
    h: 421,
    kind: "solid",
    requiresJump: true,
  };

  assert.equal(
    clampGateSolidWall([lowerStep], 790.01, 780, 440, options),
    null,
    "feet above the lower tread must be allowed to move left and descend",
  );
});

test("renders development preview metadata", async () => {
  const response = await render("/");

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("renders a validated world map model", async () => {
  const response = await render("/map");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /世界地图模拟器/);
  assert.match(html, /data-map-validation=["']valid["']/);
  assert.match(html, /data-map-rooms=["']77["']/);
  assert.match(html, /data-map-links=["']\d+["']/);
});

test("enemy demo roster honors tier, attack, and asset contracts", async () => {
  const {
    DEMO_ENEMIES,
    DEMO_ENEMIES_BY_TIER,
    DEMO_ENEMY_ORDER,
    validateDemoEnemies,
  } = await loadEnemyDemoModule();
  const enemies = DEMO_ENEMY_ORDER.map((id) => DEMO_ENEMIES[id]);

  assert.equal(validateDemoEnemies(), true);
  assert.equal(enemies.length, 18);
  assert.equal(new Set(DEMO_ENEMY_ORDER).size, 18);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(DEMO_ENEMIES_BY_TIER).map(([tier, roster]) => [
        tier,
        roster.length,
      ]),
    ),
    { normal: 10, elite: 5, boss: 3 },
  );
  assert.equal(DEMO_ENEMIES.bridge_nightmare.tier, "elite");
  assert.equal(
    enemies.reduce((count, enemy) => count + enemy.attacks.length, 0),
    50,
  );
  for (const enemy of DEMO_ENEMIES_BY_TIER.normal) {
    assert.deepEqual(
      enemy.attacks.map((attack) => [attack.kind, attack.weight]),
      [
        ["light", 75],
        ["heavy", 25],
      ],
    );
  }
  assert.deepEqual(
    [
      ...new Set(
        enemies.flatMap((enemy) =>
          enemy.attacks.map((attack) => attack.effectOrigin),
        ),
      ),
    ].sort(),
    [
      "arena-center",
      "body",
      "ground-self",
      "ground-target",
      "hand",
      "head",
      "mouth",
      "target-air",
      "target-body",
      "weapon",
    ],
  );

  for (const enemy of enemies) {
    assert.equal(
      enemy.attacks.reduce((sum, attack) => sum + attack.weight, 0),
      100,
      `${enemy.id} attack weights`,
    );
    const assetPaths = new Set([
      enemy.spritePath,
      ...enemy.attacks.map((attack) => attack.effectPath),
    ]);
    for (const assetPath of assetPaths) {
      const assetUrl = new URL(`../public${assetPath}`, import.meta.url);
      assert.equal(existsSync(assetUrl), true, `${assetPath} must exist`);
      const header = readFileSync(assetUrl).subarray(0, 12);
      assert.equal(header.subarray(0, 4).toString("ascii"), "RIFF");
      assert.equal(
        header.subarray(8, 12).toString("ascii"),
        "WEBP",
        `${assetPath} must be a WebP`,
      );
    }
  }
});
