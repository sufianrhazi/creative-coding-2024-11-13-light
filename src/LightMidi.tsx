import Gooey, { calc, collection, field, model, ref } from '@srhazi/gooey';
import type { Component, Field } from '@srhazi/gooey';

import './LightMidi.css';

const lowestNote = 21;
const highestNote = 108;

const getX = (width: number, noteNumber: number) => {
    return (
        width / 2 +
        Math.cos(
            (Math.PI * 5) / 4 - ((Math.PI * 3) / 2) * getNoteRange(noteNumber)
        ) *
            (width / 4)
    );
};
const getY = (height: number, noteNumber: number) => {
    return (
        height -
        (height / 2 +
            Math.sin(
                (Math.PI * 5) / 4 -
                    ((Math.PI * 3) / 2) * getNoteRange(noteNumber)
            ) *
                (height / 4))
    );
};
const getNoteRange = (noteNumber: number) => {
    return (noteNumber - lowestNote) / (highestNote - lowestNote);
};

const circleOfFithsDistance: Record<number, number> = {
    0: 0, // A
    7: 1, // E
    2: 2, // B
    9: 3, // F#
    4: 4, // C#
    11: 5, // G#
    6: 6, // D#
    1: 7, // A#
    8: 8, // F
    3: 9, // C
    10: 10, // G
    5: 11, // D
};

const getDistance = (noteNumber: number) => {
    const relativeToA = (noteNumber - lowestNote) % 12;
    const distance = circleOfFithsDistance[relativeToA];
    return distance;
};
const getHue = (noteNumber: number) => {
    return getDistance(noteNumber) / 12;
};

type Particle = {
    noteNumber: number;
    velocity: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
    hue: number;
    start: number;
    end: number;
};

export const LightMidi: Component<{
    hideDebug: Field<boolean>;
    input: MIDIInput;
}> = ({ hideDebug, input }, { onMount }) => {
    const canvasRef = ref<HTMLCanvasElement>();
    const gravitationalConstant = field(400);
    const particlesPerFrame = field(7);
    const particleDuration = field(3000);
    const sustainDuration = field(5000);
    const startVelocity = field(26);
    onMount(() => {
        if (!canvasRef.current) {
            alert('Could not get canvas ref');
            return;
        }
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            alert('Could not get canvas context');
            return;
        }
        let prevTick = performance.now();
        let particles: Particle[] = [];
        const tick = () => {
            const now = performance.now();
            const dt = now - prevTick;
            const alive: Particle[] = [];
            const width = canvasWidth.get();
            const height = canvasHeight.get();
            for (const particle of particles) {
                particle.x += particle.dx * dt;
                particle.y += particle.dy * dt;
                if (now < particle.end) {
                    alive.push(particle);
                }
            }
            for (let i = lowestNote; i <= highestNote; ++i) {
                const state = noteState[i];
                if (state !== null) {
                    for (let j = 0; j < particlesPerFrame.get(); ++j) {
                        alive.push({
                            noteNumber: i,
                            x: getX(width, i),
                            y: getY(height, i),
                            dx:
                                (startVelocity.get() / 50) *
                                (Math.random() - 0.5),
                            dy:
                                (startVelocity.get() / 50) *
                                (Math.random() - 0.5),
                            hue: getHue(i),
                            start: now,
                            end: sustain.get()
                                ? now + sustainDuration.get()
                                : now + particleDuration.get() * state.velocity,
                            velocity: state.velocity,
                        });
                    }
                }
            }
            const active = activeNotes.get();
            active.forEach((note) => {
                alive.forEach((particle) => {
                    if (particle.noteNumber !== note.noteNumber) {
                        const dx = note.x - particle.x;
                        const dy = note.y - particle.y;
                        const xsq = dx ** 2;
                        const ysq = dy ** 2;
                        const distanceSquared = xsq + ysq;
                        if (distanceSquared > 1) {
                            const gravity = gravitationalConstant.get() / 100;
                            particle.dx +=
                                (note.velocity * gravity * dx) /
                                distanceSquared;
                            particle.dy +=
                                (note.velocity * gravity * dy) /
                                distanceSquared;
                        }
                    }
                });
            });
            ctx.clearRect(0, 0, width, height);
            for (const particle of alive) {
                const age =
                    1 -
                    (now - particle.start) / (particle.end - particle.start);
                ctx.beginPath();
                ctx.rect(particle.x - 1, particle.y - 1, 3, 3);
                ctx.fillStyle = `hsl(${particle.hue * 1}turn 100% ${100 * age * particle.velocity}%)`;
                ctx.fill();
            }
            prevTick = now;
            nextFrame = requestAnimationFrame(tick);
            particles = alive;
        };
        let nextFrame = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(nextFrame);
        };
    });
    const canvasWidth = field(document.documentElement.clientWidth);
    const canvasHeight = field(document.documentElement.clientHeight);
    onMount(() => {
        const onResize = () => {
            canvasWidth.set(document.documentElement.clientWidth);
            canvasHeight.set(document.documentElement.clientHeight);
        };
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
        };
    });
    const rawNoteState: Record<
        number,
        { velocity: number; start: number } | null
    > = {};
    const rawSustainState: Record<number, boolean> = {};
    const noteNumbers: number[] = [];
    for (let i = lowestNote; i <= highestNote; ++i) {
        noteNumbers.push(i);
        rawNoteState[i] = null; // Math.random() < 1 / 12 ? Math.random() : null;
        rawSustainState[i] = false;
    }
    const noteState = model(rawNoteState);
    const sustainState = model(rawSustainState);
    const activeNotes = calc(() => {
        const active: {
            noteNumber: number;
            velocity: number;
            x: number;
            y: number;
        }[] = [];
        for (let i = lowestNote; i <= highestNote; ++i) {
            const state = noteState[i];
            if (state !== null) {
                active.push({
                    noteNumber: i,
                    velocity: state.velocity,
                    x: getX(canvasWidth.get(), i),
                    y: getY(canvasHeight.get(), i),
                });
            }
        }
        return active;
    });
    const sustain = field(false);
    const notes = collection<Uint8Array>([]);
    const onMessage = (e: MIDIMessageEvent) => {
        if (e.data) {
            if (e.data.length === 1 && e.data[0] === 248) {
                // ignore
                return;
            }
            if (e.data.length === 1 && e.data[0] === 254) {
                // ignore
                return;
            }
            if (e.data.length === 3 && e.data[0] === 144 && e.data[2] !== 127) {
                if (e.data[2] === 0) {
                    noteState[e.data[1]] = null;
                } else {
                    noteState[e.data[1]] = {
                        velocity: e.data[2] / 127,
                        start: performance.now(),
                    };
                    if (sustain.get()) {
                        sustainState[e.data[1]] = true;
                    }
                }
                return;
            }
            if (
                e.data.length === 3 &&
                ((e.data[0] === 176 &&
                    (e.data[2] === 0 || e.data[2] === 127)) ||
                    (e.data[0] === 144 && e.data[2] === 127))
            ) {
                sustain.set(e.data[2] === 127);
                if (!sustain.get()) {
                    for (let i = lowestNote; i <= highestNote; ++i) {
                        sustainState[i] = false;
                    }
                }
            }
            notes.push(e.data);
        }
    };
    onMount(() => {
        input.addEventListener('midimessage', onMessage);
        return () => {
            input.removeEventListener('midimessage', onMessage);
        };
    });
    return (
        <div
            class="LightMidi"
            cssprop:width={canvasWidth}
            cssprop:height={canvasHeight}
        >
            <canvas
                class="canvas"
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
            />
            {calc(
                () =>
                    !hideDebug.get() && (
                        <details open>
                            <summary>Debug</summary>
                            <div>
                                <label>
                                    Gravitational constant:
                                    <input
                                        type="range"
                                        value={gravitationalConstant}
                                        on:input={(e, el) =>
                                            gravitationalConstant.set(
                                                el.valueAsNumber
                                            )
                                        }
                                        min="0"
                                        max="1000"
                                    />
                                </label>
                                <input
                                    type="number"
                                    readonly
                                    value={gravitationalConstant}
                                    on:input={(e, el) =>
                                        gravitationalConstant.set(
                                            el.valueAsNumber
                                        )
                                    }
                                />
                            </div>
                            <div>
                                <label>
                                    Particles per frame:
                                    <input
                                        type="range"
                                        value={particlesPerFrame}
                                        on:input={(e, el) =>
                                            particlesPerFrame.set(
                                                el.valueAsNumber
                                            )
                                        }
                                        min="1"
                                        max="100"
                                    />
                                </label>
                                <input
                                    type="number"
                                    value={particlesPerFrame}
                                    on:input={(e, el) =>
                                        particlesPerFrame.set(el.valueAsNumber)
                                    }
                                />
                            </div>
                            <div>
                                <label>
                                    Particles duration:
                                    <input
                                        type="range"
                                        value={particleDuration}
                                        on:input={(e, el) =>
                                            particleDuration.set(
                                                el.valueAsNumber
                                            )
                                        }
                                        min="0"
                                        max="10000"
                                    />
                                </label>
                                <input
                                    type="number"
                                    readonly
                                    value={particleDuration}
                                    on:input={(e, el) =>
                                        particleDuration.set(el.valueAsNumber)
                                    }
                                />
                            </div>
                            <div>
                                <label>
                                    Sustain duration:
                                    <input
                                        type="range"
                                        value={sustainDuration}
                                        on:input={(e, el) =>
                                            sustainDuration.set(
                                                el.valueAsNumber
                                            )
                                        }
                                        min="0"
                                        max="10000"
                                    />
                                </label>
                                <input
                                    type="number"
                                    readonly
                                    value={sustainDuration}
                                    on:input={(e, el) =>
                                        sustainDuration.set(el.valueAsNumber)
                                    }
                                />
                            </div>
                            <div>
                                <label>
                                    Start velocity:
                                    <input
                                        type="range"
                                        value={startVelocity}
                                        on:input={(e, el) =>
                                            startVelocity.set(el.valueAsNumber)
                                        }
                                        min="0"
                                        max="200"
                                    />
                                </label>
                                <input
                                    type="number"
                                    readonly
                                    value={startVelocity}
                                    on:input={(e, el) =>
                                        startVelocity.set(el.valueAsNumber)
                                    }
                                />
                            </div>
                        </details>
                    )
            )}
            <div class="LightMidi_notes">
                {noteNumbers.map((noteNumber) => {
                    return (
                        <div
                            style:left={calc(
                                () => `${getX(canvasWidth.get(), noteNumber)}px`
                            )}
                            style:top={calc(
                                () =>
                                    `${getY(canvasHeight.get(), noteNumber)}px`
                            )}
                            class={calc(() =>
                                noteState[noteNumber] === null
                                    ? 'note'
                                    : 'note pressed'
                            )}
                            cssprop:hue={getHue(noteNumber)}
                            cssprop:velocity={calc(() =>
                                noteState[noteNumber] === null
                                    ? '0'
                                    : noteState[noteNumber].velocity
                            )}
                        />
                    );
                })}
            </div>
        </div>
    );
};
