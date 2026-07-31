import type { ColabMessage } from "colab-protocol";
import { COLAB_EVENTS, COLAB_SERVER_EVENTS } from "colab-protocol";

export interface ClientToServerEvents {
  [COLAB_EVENTS.POINTER]: (
    message: ColabMessage<typeof COLAB_EVENTS.POINTER>,
  ) => void;
  [COLAB_EVENTS.INTERACTION]: (
    message: ColabMessage<typeof COLAB_EVENTS.INTERACTION>,
  ) => void;
  [COLAB_EVENTS.UPDATE]: (
    message: ColabMessage<typeof COLAB_EVENTS.UPDATE>,
  ) => void;
  [COLAB_EVENTS.LEAVE]: (message: ColabMessage<typeof COLAB_EVENTS.LEAVE>) => void;
}

export interface ServerToClientEvents {
  [COLAB_SERVER_EVENTS.ROSTER]: (
    message: ColabMessage<typeof COLAB_SERVER_EVENTS.ROSTER>,
  ) => void;
  [COLAB_SERVER_EVENTS.PARTICIPANT_JOINED]: (
    message: ColabMessage<typeof COLAB_SERVER_EVENTS.PARTICIPANT_JOINED>,
  ) => void;
  [COLAB_SERVER_EVENTS.PARTICIPANT_UPDATED]: (
    message: ColabMessage<typeof COLAB_SERVER_EVENTS.PARTICIPANT_UPDATED>,
  ) => void;
  [COLAB_SERVER_EVENTS.PARTICIPANT_LEFT]: (
    message: ColabMessage<typeof COLAB_SERVER_EVENTS.PARTICIPANT_LEFT>,
  ) => void;
  [COLAB_SERVER_EVENTS.POINTER]: (
    message: ColabMessage<typeof COLAB_SERVER_EVENTS.POINTER>,
  ) => void;
  [COLAB_SERVER_EVENTS.INTERACTION]: (
    message: ColabMessage<typeof COLAB_SERVER_EVENTS.INTERACTION>,
  ) => void;
}

export interface InterServerEvents {
  ping: () => void;
}
