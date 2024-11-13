import Gooey, { calc, collection, field } from '@srhazi/gooey';
import type { Component } from '@srhazi/gooey';

import { LightMidi } from './LightMidi';

export const LightApp: Component = (props, { onMount }) => {
    const loading = field(false);
    const initialized = field(false);
    const connectHidden = field(false);
    const inputs = collection<MIDIInput>([]);
    const selectedInput = field<MIDIInput | undefined>(undefined);
    onMount(() => {
        document.body.addEventListener('keypress', (e) => {
            if (e.key === 'c') {
                connectHidden.set(false);
            }
        });
    });
    return (
        <>
            {calc(() => {
                const input = selectedInput.get();
                if (!input) return null;
                return <LightMidi hideDebug={connectHidden} input={input} />;
            })}
            {calc(
                () =>
                    !connectHidden.get() && (
                        <details open>
                            <summary>
                                MIDI:{' '}
                                {calc(() => {
                                    const selected = selectedInput.get();
                                    if (!selected) {
                                        return <>(no device selected)</>;
                                    }
                                    return <b>{selected.name}</b>;
                                })}
                            </summary>
                            {inputs.mapView((input) => (
                                <div>
                                    <label>
                                        <input
                                            type="radio"
                                            checked={calc(
                                                () =>
                                                    selectedInput.get()?.id ===
                                                    input.id
                                            )}
                                            on:click={(e, el) => {
                                                if (el.checked) {
                                                    selectedInput.set(input);
                                                }
                                            }}
                                        />{' '}
                                        {input.name} ({input.manufacturer})
                                    </label>
                                </div>
                            ))}
                            <p>
                                <button
                                    class="LightApp_start"
                                    disabled={calc(
                                        () => loading.get() || initialized.get()
                                    )}
                                    on:click={async () => {
                                        loading.set(true);
                                        const midiAccess =
                                            await navigator.requestMIDIAccess({
                                                software: true,
                                            });
                                        const updatePorts = () => {
                                            const existing = new Set<string>(
                                                inputs.map((input) => input.id)
                                            );
                                            const newInputs = new Set<string>();
                                            midiAccess.inputs.forEach(
                                                (input) => {
                                                    newInputs.add(input.id);
                                                }
                                            );
                                            const toReset: MIDIInput[] = [];
                                            inputs.forEach((input) => {
                                                if (newInputs.has(input.id)) {
                                                    toReset.push(input);
                                                }
                                            });
                                            midiAccess.inputs.forEach(
                                                (input) => {
                                                    if (
                                                        !existing.has(input.id)
                                                    ) {
                                                        toReset.push(input);
                                                    }
                                                }
                                            );
                                            inputs.splice(
                                                0,
                                                inputs.length,
                                                ...toReset
                                            );
                                        };
                                        midiAccess.addEventListener(
                                            'statechange',
                                            updatePorts
                                        );
                                        updatePorts();
                                        loading.set(false);
                                        initialized.set(true);
                                    }}
                                >
                                    Click to find devices (
                                    {calc(() => inputs.length)} devices found)
                                </button>
                                <button
                                    on:click={() => connectHidden.set(true)}
                                >
                                    Hide Controls (press c to reveal)
                                </button>
                                <button
                                    on:click={() =>
                                        document.documentElement
                                            .requestFullscreen()
                                            .then(() => {})
                                            .catch(() =>
                                                alert(
                                                    "Sorry, can't make the page full screen"
                                                )
                                            )
                                    }
                                >
                                    Fullscreen
                                </button>
                            </p>
                        </details>
                    )
            )}
        </>
    );
};
