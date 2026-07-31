// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { COLAB_SERVER_EVENTS, createMessage } from "colab-protocol";
import type { Identity, Participant } from "colab-protocol";

import { createFakeStore, createFakeTransport } from "../../__tests__/fakes.js";
import { ColabProvider } from "../../react/ColabProvider.js";
import type { FakeTransport } from "../../__tests__/fakes.js";
import { AvatarStack } from "./index.js";

const identity: Identity = { id: "me", name: "Me", color: "#ffffff" };

const roster: readonly Participant[] = [
  { id: "p1", name: "Ada Lovelace", color: "#112233" },
  { id: "p2", name: "Bob Chen", color: "#445566" },
  { id: "p3", name: "Cy", color: "#778899" },
  { id: "p4", name: "Dana Scully", color: "#aa5500" },
  { id: "p5", name: "Eli Stone", color: "#008877" },
];

function mountAvatarStack(
  props: React.ComponentProps<typeof AvatarStack> = {},
): { container: HTMLElement; transport: FakeTransport; unmount: () => void } {
  const transport = createFakeTransport();
  const view = render(
    <ColabProvider
      serverUrl="https://relay.example"
      room="r"
      identity={identity}
      transport={transport}
      store={createFakeStore()}
    >
      <AvatarStack {...props} />
    </ColabProvider>,
  );

  return { container: view.container, transport, unmount: view.unmount };
}

function join(transport: FakeTransport, participants: readonly Participant[]): void {
  act(() => {
    for (const participant of participants) {
      transport.emit(
        createMessage(
          COLAB_SERVER_EVENTS.PARTICIPANT_JOINED,
          participant.id,
          participant,
        ),
      );
    }
  });
}

function elements(
  container: HTMLElement,
  selector: string,
): readonly HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

describe("AvatarStack roster rendering (TC-001)", () => {
  it("renders current roster avatars with initials, colors, and overlap", () => {
    const view = mountAvatarStack();
    join(view.transport, roster.slice(0, 3));

    const avatars = elements(view.container, ".colab-avatar-stack__avatar");
    const items = elements(view.container, ".colab-avatar-stack__item");
    expect(avatars).toHaveLength(3);
    expect(screen.getByText("AL")).toBeTruthy();
    expect(screen.getByText("BC")).toBeTruthy();
    expect(screen.getByText("C")).toBeTruthy();
    expect(avatars[0]?.style.backgroundColor).toBe("rgb(17, 34, 51)");
    expect(avatars[1]?.style.backgroundColor).toBe("rgb(68, 85, 102)");
    expect(items[0]?.style.marginLeft).toBe("0px");
    expect(items[1]?.style.marginLeft).toBe("-10px");

    view.unmount();
  });
});

describe("AvatarStack overflow (TC-002)", () => {
  it("caps visible avatars and renders the overflow count", () => {
    const view = mountAvatarStack({ max: 3 });
    join(view.transport, roster);

    expect(elements(view.container, ".colab-avatar-stack__avatar")).toHaveLength(3);
    expect(screen.getByText("+2")).toBeTruthy();

    view.unmount();
  });
});

describe("AvatarStack render prop (TC-003)", () => {
  it("uses custom avatar output when supplied and defaults otherwise", () => {
    const custom = mountAvatarStack({
      renderAvatar: (participant) => (
        <span data-testid={`custom-${participant.id}`}>{participant.name}</span>
      ),
    });
    join(custom.transport, roster.slice(0, 2));

    expect(screen.getByTestId("custom-p1")).toBeTruthy();
    expect(screen.getByTestId("custom-p2")).toBeTruthy();
    expect(custom.container.querySelector(".colab-avatar-stack__avatar")).toBeNull();
    custom.unmount();

    const defaults = mountAvatarStack();
    join(defaults.transport, roster.slice(0, 2));

    expect(screen.getByText("AL")).toBeTruthy();
    expect(screen.getByText("BC")).toBeTruthy();
    defaults.unmount();
  });
});
