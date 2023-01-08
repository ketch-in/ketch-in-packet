import Observable from "./Observable";
import WebRTC from "./WebRTC";

const STATUS_TEXT = {
  idle: "대기중",
  painting: "그리는 중",
};

export type SharedType = "screen" | "window" | "browser:tab" | "";

interface ToolOptions {
  // 그리기 색 지정
  color?: string;
}

interface EventMap<T extends keyof ExtraMap> {
  onError: (self: Packet<T>, error: any) => void;
  onDisconnect: (self: Packet<T>) => void;
  onChangeUsers: (
    self: Packet<T>,
    type: "join" | "exit" | "update",
    from: Connection
  ) => void;
  onNotSupportMessage: (self: Packet<T>, message: MessagePayload) => void;
  onStoppedShared: (self: Packet<T>) => void;
  onDraw: (
    self: Packet<T>,
    payload: PayloadMap[keyof PayloadMap],
    from: Connection
  ) => void;
}

interface User {
  id: string;
  name: string;
  status: keyof typeof STATUS_TEXT;
  version: string;
}

interface BaseExtra {
  type: keyof ExtraMap;
}

interface HostExtra extends BaseExtra {
  type: "host";
  // 익스텐션 사용자 ID (host 소유자)
  extensionId: string;
  // 그리기 허용 여부
  active: boolean;
  // 발표 유형 (전체화면, 창, 브라우저...)
  sharedType: SharedType;
  // 발표 스크린 번호 (SharedType이 전체화면일 경우 존재)
  sharedScreen: number;
}

interface ExtensionExtra extends BaseExtra {
  type: "extension";
  // 그리기 도구 옵션
  tool: ToolOptions;
  // 발표 영상 ID (ex, spaces/...)
  hostId: string;
  // 사용자의 영상 ID (ex, spaces/...)
  dataParticipantId: string;
}

interface ThirdPartyExtra extends BaseExtra {
  type: "thirdParty";
  // 그리기 도구 옵션
  tool: ToolOptions;
  // extension의 사용자 식별 ID
  extensionId: string;
}

interface BaseUpdateExtra {
  type?: keyof ExtraMap;
}

interface HostUpdateExtra extends BaseUpdateExtra {
  // 익스텐션 사용자 ID (host 소유자)
  extensionId?: string;
  // 그리기 허용 여부
  active?: boolean;
  // 발표 유형 (전체화면, 창, 브라우저...)
  sharedType?: SharedType;
  // 발표 스크린 번호 (SharedType이 전체화면일 경우 존재)
  sharedScreen?: number;
}

interface ExtensionUpdateExtra extends BaseUpdateExtra {
  // 그리기 도구 옵션
  tool?: ToolOptions;
  // 발표 영상 ID (ex, spaces/...)
  hostId?: string;
  // 사용자의 영상 ID (ex, spaces/...)
  dataParticipantId?: string;
}

interface ThirdPartyUpdateExtra extends BaseUpdateExtra {
  // 그리기 도구 옵션
  tool?: ToolOptions;
  // extension의 사용자 식별 ID
  extensionId?: string;
}

interface ExtraMap {
  host: HostExtra;
  extension: ExtensionExtra;
  thirdParty: ThirdPartyExtra;
}

interface ExtraUpdateMap {
  host: HostUpdateExtra;
  extension: ExtensionUpdateExtra;
  thirdParty: ThirdPartyUpdateExtra;
}

interface PayloadPen {
  type: "pen";
  data: [number, number, number, number, "up" | "down" | "move"];
}

interface PayloadMap {
  pen: PayloadPen;
}

export interface Connection {
  user: User;
  extra: ExtraMap[keyof ExtraMap];
}
interface Connections {
  [id: string]: Connection;
}

interface MessagePayload {
  user: User;
  extra?: ExtraMap[keyof ExtraMap];
  target: string;
  payload?: PayloadMap[keyof PayloadMap];
}

interface WebRTCMessageMap {
  "user:join": MessagePayload;
  "user:update": MessagePayload;
  "user:painting": MessagePayload;
}

interface PacketInterface<T extends keyof ExtraMap> {
  name: string;
  extra: ExtraMap[T];
  meetId: string;
  version: string;
  signalingUrl: string;
}

//@ts-ignore
const thisGlobal = typeof window ? window : global;
if (!thisGlobal.structuredClone) {
  thisGlobal.structuredClone = (val: any) => JSON.parse(JSON.stringify(val));
}

export default class Packet<T extends keyof ExtraMap> extends Observable<
  EventMap<T>
> {
  public readonly meetId: string;
  private _user: User;
  private _extra: ExtraMap[T];
  private _webRtc: WebRTC<WebRTCMessageMap>;
  private _connections: Connections;

  constructor({
    name,
    extra,
    meetId,
    version,
    signalingUrl,
  }: PacketInterface<T>) {
    super();
    this._user = {
      name,
      version,
      id: "",
      status: "idle",
    };
    this.meetId = meetId;
    this._extra = extra;
    this._webRtc = new WebRTC(meetId, signalingUrl);
    this._connections = {};
    this._initialize();
  }

  private _initialize() {
    this._webRtc.addEventListener("onNewConnect", (_, { userid }) => {
      this._webRtc.sendMessage("user:join", this._createPayload(userid));
    });
    this._webRtc.addEventListener("onError", (_, error) => {
      this.emit("onError", error);
    });
    this._webRtc.addEventListener("onOpen", (_, userid) => {
      this._user.id = userid;
      this._update();
    });
    this._webRtc.addEventListener("onChangedUserId", (_, userid) => {
      this._user.id = userid;
      this._update();
    });
    this._webRtc.addEventListener("onDisconnect", () => {
      this.emit("onDisconnect");
      this.destroy();
    });
    this._webRtc.addEventListener("onLeave", (_, connectionInfo) => {
      const data = this._findById(connectionInfo.userid);
      delete this._connections[connectionInfo.userid];
      this.emit("onChangeUsers", "exit", data);
    });
    this._webRtc.addEventListener("onMessage", (_, type, payload) => {
      if (payload.target !== "all" && payload.target !== this._user.id) {
        this.emit("onNotSupportMessage", payload);
        return;
      }

      const targetId = payload.user.id;
      if (type === "user:join") {
        this._connections[targetId] = {
          user: payload.user,
          extra: payload.extra,
        };
        this.emit("onChangeUsers", "join", this._findById(targetId));
        return;
      }

      // 사용자가 업데이트 되었을 때 발생합니다.
      if (type === "user:update") {
        this._connections[targetId] = {
          user: payload.user,
          extra: payload.extra,
        };
        // 만약 내가 host인 상태에서 나를 소유하는 extension가 업데이트 되었을 때 발생합니다.
        if (
          this._extra.type === "host" &&
          payload.extra.type === "extension" &&
          this._extra.extensionId === targetId
        ) {
          // hostId가 비어있다면 발표가 중단 된 것이므로 onStoppedShared 이벤트가 발생합니다.
          if (payload.extra.hostId === "") {
            this.emit("onStoppedShared");
          }
        }
        this.emit("onChangeUsers", "update", this._findById(targetId));
        return;
      }

      if (type === "user:painting") {
        if (
          payload.target === "all" ||
          payload.target !== this.id ||
          this.type !== "host" ||
          typeof payload.payload !== "object"
        ) {
          return;
        }
        this.emit("onDraw", payload.payload, this._findById(targetId));
        return;
      }

      // 지원하지 않는 포맷일 경우 onNotSupportMessage 이벤트가 실행됩니다.
      this.emit("onNotSupportMessage", payload);
    });
    this._webRtc.initialize();
  }

  private _findById(id: string) {
    return this._connections[id] ? this._connections[id] : null;
  }

  private _findByType(type: keyof ExtraMap) {
    return Object.keys(this._connections)
      .filter((id) => this._connections[id].extra.type === type)
      .map((id) => this._findById(id));
  }

  private _findByVideoId(videoId: string) {
    if (
      this._extra.type === "extension" &&
      (this._extra.hostId === videoId ||
        this._extra.dataParticipantId === videoId)
    ) {
      const payload = this._createPayload();
      return {
        user: payload.user,
        extra: payload.extra,
      };
    }
    return this._findById(
      Object.keys(this._connections).find((id) => {
        const connection = this._connections[id];
        if (connection.extra.type !== "extension") {
          return false;
        }
        return (
          connection.extra.hostId === videoId ||
          connection.extra.dataParticipantId === videoId
        );
      })
    );
  }

  private _createPayload(target = "all", payload?: any) {
    const data = { target, user: this._user, extra: this._extra };
    return payload ? { ...data, payload } : data;
  }

  // 내 데이터를 다른 사용자에게 전파합니다. target으로 대상을 지정할 수 있습니다.
  private _update(target = "all") {
    this._webRtc.sendMessage("user:update", this._createPayload(target));
  }

  private _toConnection(connection?: Connection) {
    if (!connection) {
      return { id: "", name: "", version: "" };
    }
    return { ...connection.user };
  }

  private _setStatus(status: keyof typeof STATUS_TEXT) {
    this._user.status = status;
    this._update();
  }

  get id() {
    return this._user.id;
  }

  // 사용자의 이름을 변경합니다.
  set name(name: string) {
    this._user.name = name;
    this._update();
  }

  get name() {
    return this._user.name;
  }

  get type(): keyof ExtraMap {
    return this._extra.type;
  }

  get status() {
    return STATUS_TEXT[this._user.status];
  }

  // 접속 중인 "사람" 수만 반환합니다.
  get length() {
    return this._findByType("extension").length;
  }

  get version() {
    return this._user.version;
  }

  get isShared() {
    return this._extra.type === "extension" && !!this._extra.hostId;
  }

  get hosts() {
    return this._findByType("host").map((connection) =>
      this._toConnection(connection)
    );
  }

  get extensions() {
    return this._findByType("extension").map((connection) =>
      this._toConnection(connection)
    );
  }

  get thirdParties() {
    return this._findByType("thirdParty").map((connection) =>
      this._toConnection(connection)
    );
  }

  // 나의 옵션을 업데이트 합니다.
  set extra(newExtra: ExtraUpdateMap[T]) {
    this._extra = { ...this._extra, ...newExtra };
    this._update();
  }

  // 옵션을 반환합니다.
  get extra() {
    return structuredClone(this._extra);
  }

  getHostByExtension(extensionId: string) {
    return this._toConnection(
      this._findByType("host").find(
        (item) =>
          item.extra.type === "host" && item.extra.extensionId === extensionId
      )
    );
  }

  getTool(id: string = this._user.id) {
    const connection = this._findById(id);
    if (
      connection.extra.type === "extension" ||
      connection.extra.type === "thirdParty"
    ) {
      return structuredClone(connection.extra.tool);
    }
    return {};
  }

  // 가장 낮은 버전을 반환합니다.
  getLowerVersion(type: keyof ExtraMap = this._extra.type) {
    return this._findByType(type).reduce(
      (acc, connection) => {
        const [prevMajor, prevMinor] = acc;
        const [nextMajor, nextMinor] = connection.user.version.split(".");
        if (prevMajor > nextMajor) {
          return acc;
        }
        if (prevMajor < nextMajor) {
          return [nextMajor, nextMinor];
        }
        return prevMinor < nextMinor ? [nextMajor, nextMinor] : acc;
      },
      ["0", "0"]
    );
  }

  getUserById(id: string) {
    return this._toConnection(this._findById(id));
  }

  getUserByVideoId(id: string) {
    return this._toConnection(this._findByVideoId(id));
  }

  // 그리기를 요청합니다.
  draw(target: string, data: PayloadMap[keyof PayloadMap]) {
    if (data.data[4] === "down") {
      this._setStatus("painting");
    }
    if (data.data[4] === "up") {
      this._setStatus("idle");
    }
    this._webRtc.sendMessage(
      "user:painting",
      this._createPayload(target, data)
    );
  }

  // 모든 연결을 끊고 이벤트를 종료합니다.
  destroy() {
    super.destroy();
    this._webRtc.destroy();
  }
}
