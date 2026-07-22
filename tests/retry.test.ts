import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { withExponentialBackoff } from "../src/retry";

interface SimulatedHttpError {
  status: number;
}

const shouldRetry429 = (error: unknown): boolean =>
  (error as SimulatedHttpError).status === 429;

describe("withExponentialBackoff", () => {
  it("reintenta dos respuestas 429 y luego retorna el resultado", async () => {
    let attempts = 0;
    const recordedDelays: number[] = [];

    const result = await withExponentialBackoff(
      async () => {
        attempts += 1;

        if (attempts <= 2) {
          throw { status: 429 } satisfies SimulatedHttpError;
        }

        return "PDF descargado";
      },
      {
        maxAttempts: 5,
        baseDelayMilliseconds: 1_000,
        maximumDelayMilliseconds: 30_000,
        shouldRetry: shouldRetry429,
        sleep: async (milliseconds) => {
          recordedDelays.push(milliseconds);
        },
      },
    );

    assert.equal(result, "PDF descargado");
    assert.equal(attempts, 3);
    assert.deepEqual(recordedDelays, [1_000, 2_000]);
  });

  it("abandona despues de cinco respuestas 429", async () => {
    let attempts = 0;
    const recordedDelays: number[] = [];

    await assert.rejects(
      withExponentialBackoff(
        async () => {
          attempts += 1;
          throw { status: 429 } satisfies SimulatedHttpError;
        },
        {
          maxAttempts: 5,
          baseDelayMilliseconds: 1_000,
          maximumDelayMilliseconds: 30_000,
          shouldRetry: shouldRetry429,
          sleep: async (milliseconds) => {
            recordedDelays.push(milliseconds);
          },
        },
      ),
    );

    assert.equal(attempts, 5);
    assert.deepEqual(recordedDelays, [1_000, 2_000, 4_000, 8_000]);
  });

  it("no reintenta un error 400", async () => {
    let attempts = 0;
    const recordedDelays: number[] = [];

    await assert.rejects(
      withExponentialBackoff(
        async () => {
          attempts += 1;
          throw { status: 400 } satisfies SimulatedHttpError;
        },
        {
          maxAttempts: 5,
          baseDelayMilliseconds: 1_000,
          maximumDelayMilliseconds: 30_000,
          shouldRetry: shouldRetry429,
          sleep: async (milliseconds) => {
            recordedDelays.push(milliseconds);
          },
        },
      ),
    );

    assert.equal(attempts, 1);
    assert.deepEqual(recordedDelays, []);
  });
});
