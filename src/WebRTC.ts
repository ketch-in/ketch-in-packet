import Observable from "./Observable";

//@ts-ignore
import RTCMultiConnection from "rtcmulticonnection";
import { io } from "socket.io-client";

interface EventMap<T> {
  // connection 이 생성되었습니다.
  onOpen: (self: WebRTC<T>, userid: string) => void;
  // 새로운 connection 요청이 들어왔습니다.
  onNewConnect: (self: WebRTC<T>, connectionInfo: WebRTCConnectInfo) => void;
  // 아이디 중복으로 변경되었을 경우 호출됩니다.
  onChangedUserId: (self: WebRTC<T>, userid: string) => void;
  onError: (self: WebRTC<T>, error?: any) => void;
  onMessage: <K extends keyof T>(
    self: WebRTC<T>,
    type: K,
    payload: T[K]
  ) => void;
  onDisconnect: (self: WebRTC<T>, ...args: any[]) => void;
  onStatusUpdate: (
    self: WebRTC<T>,
    event: {
      userid: string;
      status: "online" | "offline";
    }
  ) => void;
  // 다른 사용자와 연결이 끊겼을 경우 호출됩니다.
  onLeave: (self: WebRTC<T>, connectionInfo: WebRTCConnectInfo) => void;
}

interface WebRTCOptionsInterface {
  meetId?: string;
  signalingUrl?: string;
}

interface WebRTCConnectInfo {
  // WebRTC Channel Object
  channel: object;
  // WebRTC extra Object
  extra: { [key: string]: any };
  // Session ID
  userid: string;
}

//@ts-ignore
const thisGlobal = typeof window ? window : global;
thisGlobal.io = io;

const CHUNK_SIZE = 60 * 1000;
const SOCKET_MESSAGE_EVENT = "data-sharing";

export default class WebRTC<T> extends Observable<EventMap<T>> {
  private meetId: string;
  private signalingUrl: string;
  private connection: any;

  constructor(meetId: string, signalingUrl: string) {
    super();

    this.meetId = meetId;
    this.signalingUrl =
      signalingUrl[signalingUrl.length - 1] === "/"
        ? signalingUrl
        : `${signalingUrl}/`;
  }

  initialize(): void {
    if (this.connection) {
      this.close();
    }

    if (!this.meetId || !this.signalingUrl) {
      this.emit("onError", null);
      return;
    }

    this.connection = new RTCMultiConnection();
    this.connection.socketURL = this.signalingUrl;
    this.connection.socketMessageEvent = SOCKET_MESSAGE_EVENT;
    this.connection.chunkSize = CHUNK_SIZE;
    this.connection.sdpConstraints.mandatory = {
      OfferToReceiveAudio: false,
      OfferToReceiveVideo: false,
    };
    this.connection.session = { data: true };

    this.connection.checkPresence(this.meetId, (isRoomExist: boolean) =>
      this.onConnection(isRoomExist)
    );
    this.connection.onopen = (connectionInfo: WebRTCConnectInfo) => {
      // new connection
      this.emit("onNewConnect", connectionInfo);
    };
    this.connection.onmessage = <K extends keyof T>(e: {
      data: { type: K; payload: T[K] };
    }) => {
      this.emit("onMessage", e.data.type, e.data.payload);
    };
    this.connection.onerror = (error: any) => {
      this.emit("onError", error);
    };
    this.connection.onSocketDisconnect = (event: any) => {
      this.destroy();
    };
    this.connection.socket.on("onDisconnect", (...args: any[]) => {
      this.emit("onDisconnect", ...args);
    });
    this.connection.socket.on("userid-already-taken", (...args: any[]) => {
      this.emit("onChangedUserId", this.connection.userid);
    });
    this.connection.onleave = (connectionInfo: WebRTCConnectInfo) => {
      this.emit("onLeave", connectionInfo);
    };
  }

  private close() {
    if (this.connection === null) {
      return;
    }
    // disconnect with all users
    this.connection.getAllParticipants().forEach(function (pid: any) {
      try {
        this.connection.disconnectWith(pid);
      } catch {}
    });

    // stop all local cameras
    this.connection.attachStreams.forEach(function (localStream: {
      stop: () => void;
    }) {
      localStream.stop();
    });
    try {
      // close socket.io connection
      this.connection.closeSocket();
    } catch {}
    this.connection = null;
  }

  // 연결을 관리합니다.
  private onConnection(isRoomExist: boolean) {
    // _ : isRoomJoined -> 방이 열린 여부를 나타냅니다.
    // __ : roomId -> 룸 ID를 나타냅니다.
    const done = (_: boolean, __: string, error: string) => {
      if (!error) {
        this.emit("onOpen", this.connection.userid);
        return;
      }

      // 이미 방이 생성된 상태라면 가입을 시도합니다.
      if (!isRoomExist && error === this.connection.errors.ROOM_NOT_AVAILABLE) {
        this.onConnection(isRoomExist);
        return;
      }

      // 그 외의 에러인 경우 에러를 반환합니다.
      this.connection.onerror(error);
    };

    // sessionId가 존재하지 않으면 meetId로 초기화합니다.
    if (!this.connection.sessionid) {
      this.connection.sessionid = this.meetId;
    }

    if (!isRoomExist) {
      // 방이 없는 경우 생성자로써 방을 열기를 시도합니다.
      this.connection.isInitiator = !isRoomExist;
      this.connection.open(this.meetId, done);
      return;
    }
    this.connection.join(this.meetId, done);
  }

  // connection 부분을 초기화합니다.
  reconnection(): void {
    this.close();
    this.initialize();
  }

  // WebRTC로 message를 전송합니다.
  sendMessage<K extends keyof T>(type: K, payload: T[K]) {
    if (this.getDestroy()) {
      return;
    }
    this.connection.send({ type, payload });
  }

  // 옵션을 변경시, reconnection이 발생합니다.
  setOptions({ meetId, signalingUrl }: WebRTCOptionsInterface) {
    let changed = false;
    if (meetId && this.meetId !== meetId) {
      this.meetId = meetId;
      changed = true;
    }
    if (signalingUrl && this.signalingUrl !== signalingUrl) {
      this.signalingUrl = signalingUrl;
      changed = true;
    }
    if (changed) {
      this.reconnection();
    }
  }
  destroy(): void {
    super.destroy();
    this.close();
  }
}
