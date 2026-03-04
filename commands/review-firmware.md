---
description: Run embedded firmware code review (memory safety, ISR, RTOS, C/C++ UB)
---

Perform a structured embedded firmware code review on the C/C++ source files in this project. Focus on issues that matter in constrained, real-time, and safety-sensitive environments.

## Arguments

`$ARGUMENTS` may contain:
- A specific file or directory to review (e.g. `src/motor.c`, `components/sensors/`).
- A severity filter: `p0`, `p1`, `p2`, `p3` to show only findings at that level or above.
- The keyword `isr` to focus exclusively on interrupt service routine issues.
- The keyword `rtos` to focus exclusively on RTOS/concurrency issues.

## Step 1: Locate source files

If `$ARGUMENTS` specifies a path, review only that path. Otherwise scan:
- `main/`, `src/`, `lib/`, `components/`, `Core/Src/` (STM32CubeIDE layout)
- Include: `*.c`, `*.cpp`, `*.h`, `*.hpp`
- Exclude: `build/`, `.pio/`, `managed_components/`, third-party vendor directories.

List the files you will review before starting.

## Step 2: Review categories

Work through each category below. For every finding, record:
- **Severity** (P0-P3, defined below)
- **File and line number**
- **Short title**
- **Explanation** of why it's a problem in an embedded context
- **Suggested fix** with a corrected code snippet where helpful

### Severity levels

| Level | Meaning |
|-------|---------|
| P0 | Critical. Will cause crashes, data corruption, or undefined behavior at runtime. Fix before shipping. |
| P1 | High. Likely to cause hard-to-reproduce bugs, race conditions, or silent failures under load. |
| P2 | Medium. Bad practice that reduces reliability or portability. Should be fixed. |
| P3 | Low. Style, readability, or minor improvement. Fix when convenient. |

### Category A: Memory safety

- Stack overflows: large arrays or structs declared on the stack inside ISRs or deeply nested calls.
- Heap fragmentation: repeated `malloc`/`free` in a loop or ISR without a pool allocator.
- Buffer overruns: `strcpy`, `sprintf`, `gets` without bounds checking.
- Use-after-free or double-free patterns.
- Uninitialized variables used before assignment.
- Integer overflow in pointer arithmetic or array indexing.

### Category B: Interrupt service routines (ISRs)

- ISR functions that call `malloc`, `printf`, `vTaskDelay`, or any blocking function.
- ISR functions longer than ~20 lines without a clear reason (should defer work to a task or callback).
- Missing `volatile` on variables shared between ISR and main context.
- Missing critical section (`taskENTER_CRITICAL` / `portDISABLE_INTERRUPTS`) when accessing shared state from both ISR and task context.
- Incorrect ISR attribute or placement (e.g. ESP-IDF ISRs not in IRAM when `IRAM_ATTR` is required).

### Category C: RTOS and concurrency

- Shared global variables accessed from multiple tasks without a mutex, semaphore, or atomic operation.
- Mutex taken inside an ISR (not allowed in FreeRTOS).
- `vTaskDelay` called with `0` ticks (use `taskYIELD()` instead).
- Task stack sizes that look too small for the work being done (under 1024 bytes for non-trivial tasks).
- Semaphore or queue created but never deleted (minor leak in long-running systems).
- Priority inversion risk: high-priority task waiting on a resource held by a low-priority task without priority inheritance.
- Calling FreeRTOS API from `app_main` before the scheduler starts.

### Category D: C/C++ undefined behavior

- Signed integer overflow (use `uint32_t` arithmetic or check before overflow).
- Bit shifts on signed types or shift amounts >= type width.
- Strict aliasing violations (casting `uint8_t*` buffer to a struct pointer without `memcpy`).
- Dereferencing null or potentially-null pointers without a check.
- `memset` on a struct containing pointers (zeroing pointer values is fine, but watch for vtable pointers in C++).
- Comparing pointers from different objects with `<` or `>`.

### Category E: Peripheral and hardware interaction

- Polling loops without a timeout (can hang forever if hardware doesn't respond).
- Missing memory barriers or `__DSB()`/`__ISB()` after writing to memory-mapped registers on ARM Cortex-M.
- GPIO or peripheral not initialized before use.
- SPI/I2C transactions not protected by a mutex when called from multiple tasks.
- ADC readings used without averaging or filtering in noise-sensitive applications.
- Watchdog timer disabled or never kicked in the main loop.

### Category F: Power and resource management

- Peripherals left powered on when not in use (no sleep/disable call).
- `while(1)` busy-wait loops that prevent the CPU from entering idle/sleep.
- Timers or DMA channels started but never stopped on error paths.

## Step 3: Output format

Group findings by severity (P0 first). Use this format for each finding:

```
[P0] src/uart.c:142 - ISR calls vTaskDelay
  vTaskDelay is a blocking FreeRTOS call and must never be called from an ISR.
  It will corrupt the RTOS scheduler state and cause a hard fault.

  Fix: Use xQueueSendFromISR() to defer the work to a task, then call
  vTaskDelay in that task if a delay is needed.
```

## Step 4: Summary

After all findings, print:
- Total findings by severity (P0: N, P1: N, P2: N, P3: N).
- The single most critical issue to fix first, in one sentence.
- Any files that look clean with no findings (worth noting).
