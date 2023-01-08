<h1 align="center">KETCH IN PACKET</h1>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/@ketch-in/packet?style=flat-square" title="license"/></a>
  <a href="https://www.npmjs.com/package/@ketch-in/packet"><img src="https://img.shields.io/npm/v/@ketch-in/packet?style=flat-square" title="npm-version"/></a>
</p>

<!-- omit in toc -->

<details>
    <summary>목차</summary>

- [1. TYPE](#1-type)
  - [1.1. User](#11-user)
  - [1.2. PayloadMap](#12-payloadmap)
  - [1.3. PayloadPen](#13-payloadpen)
  - [1.4. Connection](#14-connection)
  - [1.5. HostExtra](#15-hostextra)
  - [1.6. ExtensionExtra](#16-extensionextra)
  - [1.7. ThirdPartyExtra](#17-thirdpartyextra)
  - [1.8. ToolOptions](#18-tooloptions)
- [2. EVENT](#2-event)
  - [2.1. onDisconnect](#21-ondisconnect)
  - [2.2. onError](#22-onerror)
  - [2.3. onNotSupportMessage](#23-onnotsupportmessage)
  - [2.4. onDraw](#24-ondraw)
  - [2.5. onChangeUsers](#25-onchangeusers)
  - [2.6. onStoppedShared](#26-onstoppedshared)
- [3. METHOD](#3-method)
  - [3.1. getUser](#31-getuser)
  - [3.2. getTool](#32-gettool)
  - [3.3. getVideoId](#33-getvideoid)
  - [3.4. draw](#34-draw)
  - [3.5. destroy](#35-destroy)
- [4. VARIABLE](#4-variable)

</details>

## Example <!-- omit in toc -->

```js
import Packet from "ketch-in-packet";

try {
  const packet = new Packet<"host">({
    name:"test-host".
    extra: {
      type: "host"
      active: false,
      sharedType: "screen",
      extensionId: "eb540ba7-9496-4779-a610-0b33c847384e",
      sharedScreen: 4,
    },
    meetId: "abc-abcd-abc",
    version: "0.0.1",
    signalingUrl: "https://domain.example.com/",
  });

  packet.addEventListener("onDraw", (obj, payload, from) => {
    if(!그리기허용){
      return;
    }
    const { user, extra } = from;
    if (extra.type !== 'extension' && extra.type !== 'thirdParty') {
      return;
    }
    if (payload.type === 'pen') {
      const [x, y, w, h, type] = payload.data;
      ...
      buffer(user.id, type, x, y, extra.tool.color);
      ...
    }
  });

  packet.addEventListener("onChangeUsers", (obj, type, from)=>{
    if(type === "exit"){
      const connectedUserSize = obj.length
      // 접속한 사람 수 업데이트
    }
  })

} catch (e) {
  console.log(e)
}
```

## 1. TYPE

### 1.1. User

| name    | type                                                 | description                          |
| ------- | ---------------------------------------------------- | ------------------------------------ |
| id      | string                                               | packet의 고유 식별자를 나타냅니다.   |
| name    | string                                               | 사용자 이름을 나타냅니다.            |
| status  | "대기" / "그리는 중" / "그리기 허용" / "그리기 잠금" | 사용자의 상태를 나타냅니다.          |
| version | string                                               | 사용자가 사용하는 버전을 나타냅니다. |

### 1.2. PayloadMap

| name | type                         | description          |
| ---- | ---------------------------- | -------------------- |
| pen  | [PayloadPen](#13-payloadpen) | 그리기 데이터입니다. |

### 1.3. PayloadPen

| name | type                                                       | description                             |
| ---- | ---------------------------------------------------------- | --------------------------------------- |
| type | "pen"                                                      | 그리기 유형을 지정합니다.               |
| data | [number, number, number, number, "up" or "down" or "move"] | 그리기 유형에 따른 데이터를 지정합니다. |

### 1.4. Connection

| name  | type                                                                                                      | description                 |
| ----- | --------------------------------------------------------------------------------------------------------- | --------------------------- |
| user  | [User](#11-user)                                                                                          | 사용자 정보를 나타냅니다.   |
| extra | [HostExtra](#15-hostextra) / [ExtensionExtra](#16-extensionextra) /[ThirdPartyExtra](#17-thirdpartyextra) | 사용자 데이터를 나타냅니다. |

### 1.5. HostExtra

| name         | type    | description                                          |
| ------------ | ------- | ---------------------------------------------------- |
| extensionId  | string  | 익스텐션 사용자 ID (host 소유자)                     |
| type         | "host"  | payload type                                         |
| active       | boolean | 그리기 허용 여부                                     |
| sharedType   | string  | 발표 유형 (전체화면, 창, 브라우저...)                |
| sharedScreen | number  | 발표 스크린 번호 (SharedType이 전체화면일 경우 존재) |

### 1.6. ExtensionExtra

| name               | type                           | description                       |
| ------------------ | ------------------------------ | --------------------------------- |
| tool               | [ToolOptions](#18-tooloptions) | 그리기 도구 옵션                  |
| type               | "extension"                    | payload type                      |
| hostId             | string                         | 발표 영상 ID (ex, spaces/...)     |
| dataParticipantId? | string                         | 사용자의 영상 ID (ex, spaces/...) |

### 1.7. ThirdPartyExtra

| name        | type                           | description                |
| ----------- | ------------------------------ | -------------------------- |
| tool        | [ToolOptions](#18-tooloptions) | 그리기 도구 옵션           |
| type        | "thirdParty"                   | payload type               |
| extensionId | string                         | extension의 사용자 식별 ID |

### 1.8. ToolOptions

| name  | type   | description    |
| ----- | ------ | -------------- |
| color | string | 그리기 색 지정 |

## 2. EVENT

### 2.1. onDisconnect

서버와 Connection이 끊겼을 경우 발생합니다. 발생시, WebRTC 연결도 끊기게 됩니다.

```ts
const defaultPacket = new Pack({...});
defaultPacket.addEventListener("onDisconnect", (packet:Packet)=>{});
```

### 2.2. onError

Connection 과정 중 에러가 발생했을 때 호출하게 됩니다.

```ts
const defaultPacket = new Pack({...});
defaultPacket.addEventListener("onError", (packet:Packet, errorName:ErrorName, ...args:any[])=>{});
```

### 2.3. onNotSupportMessage

지정된 메시지가 아닌 새로운 메시지가 나왔을 때 발생합니다. 버전 차이가 있을 경우 발생할 수 있습니다.

```ts
const defaultPacket = new Pack({...});
defaultPacket.addEventListener("onNotSupportMessage", (packet:Packet, message:Message)=>{});
```

### 2.4. onDraw

> Host인 경우에만 수신합니다.

그리기 요청이 있을 경우 발생합니다.

```ts
const defaultPacket = new Pack({...});
defaultPacket.addEventListener("onDraw", (packet:Packet, data:any, from:Connection)=>{});
```

### 2.5. onChangeUsers

특정 사용자의 상태가 변경되었을 경우 발생합니다.

새로운 참여, 나가기, 상태 수정, 이름 수정, 도구 상태 변경 등 전반적인 상태 변경에서 호출됩니다.

```ts
const defaultPacket = new Pack({...});
defaultPacket.addEventListener("onChangeUsers", (packet:Packet, type:"join"|"exit"|"update", from:Connection)=>{});
```

### 2.6. onStoppedShared

> Host인 경우에만 수신합니다.
>
> Host를 실행한 extension에서 넘어온 메시지에 대해서만 수신

발표중인 사용자가 발표를 중단했을 때 발생합니다.

```ts
const defaultPacket = new Pack({...});
defaultPacket.addEventListener("onStoppedShared", (packet:Packet)=>{});
```

## 3. METHOD

### 3.1. getUser

id에 해당하는 유저 정보를 반환합니다.

| input        | Description                         |
| ------------ | ----------------------------------- |
| id: `string` | 필요한 유저 정보의 ID를 나타냅니다. |

| output                       | Description               |
| ---------------------------- | ------------------------- |
| userInfo: [`User`](#11-user) | 사용자 정보를 나태냅니다. |

```ts
const defaultPacket = new Pack({...});
defaultPacket.getUser("...")
```

### 3.2. getTool

id에 해당하는 유저의 tool를 반환합니다.

| input        | Description                         |
| ------------ | ----------------------------------- |
| id: `string` | 필요한 유저 정보의 ID를 나타냅니다. |

| output                                        | Description                    |
| --------------------------------------------- | ------------------------------ |
| toolOptions: [`ToolOptions`](#18-tooloptions) | 해당 사용자의 값을 반환합니다. |

```ts
const defaultPacket = new Pack({...});
defaultPacket.getTool("...")
```

### 3.3. getVideoId

사용자 ID에 해당하는 비디오 ID를 반환합니다. `isHost`값이 `true`인 경우, 발표 비디오 ID를 반환합니다.

| input             | Description                                      |
| ----------------- | ------------------------------------------------ |
| id: `string`      | video ID를 찾고자 하는 사용자 ID를 입력합니다.   |
| isHost: `boolean` | 발표자 video를 찾고자 할 경우 true로 지정합니다. |

| output            | Description            |
| ----------------- | ---------------------- |
| videoId: `string` | video ID를 반환합니다. |

```ts
const defaultPacket = new Pack({...});
defaultPacket.getVideoId()
```

### 3.4. draw

그리기를 요청합니다.

| input                               | Description                                             |
| ----------------------------------- | ------------------------------------------------------- |
| payload: [`Painting`](#12-painting) | 그리기 정보를 입력합니다.                               |
| target: `string`                    | 그리기 정보를 보낼 사용자(`Host 한정`) ID를 입력합니다. |

```ts
const defaultPacket = new Pack({...});
defaultPacket.draw()
```

### 3.5. destroy

모든 연결을 끊고 이벤트를 종료합니다.

```ts
const defaultPacket = new Pack({...});
defaultPacket.destroy()
```

## 4. VARIABLE

| name                  | method | type (set : params, get : returns)                                                                        | description                                   |
| --------------------- | ------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| status                | set    | STATUS_TEXT                                                                                               | 사용자의 상태를 수정할 때 사용합니다.         |
| payload               | set    | [HostExtra](#15-hostextra) / [ExtensionExtra](#16-extensionextra) /[ThirdPartyExtra](#17-thirdpartyextra) | 사용자의 옵션을 업데이트합니다.               |
| payload               | get    | [HostExtra](#15-hostextra) / [ExtensionExtra](#16-extensionextra) /[ThirdPartyExtra](#17-thirdpartyextra) | 사용자의 옵션을 반환합니다.                   |
| id                    | get    | string                                                                                                    | 사용자의 ID를 반환합니다.                     |
| type                  | get    | string                                                                                                    | 사용자의 유형을 반환합니다.                   |
| version               | get    | string                                                                                                    | 사용자가 사용하는 버전을 반환합니다.          |
| length                | get    | number                                                                                                    | 접속 중인 "사람" 수만 반환합니다.             |
| lowerExtensionVersion | get    | string                                                                                                    | 익스텐션 버전 중 가장 낮은 버전을 반환합니다. |
| users                 | get    | [`User`](#11-user)[]                                                                                      | 접속하고 있는 모든 사용자를 반환합니다.       |
| hostUsers             | get    | [`User`](#11-user)                                                                                        | 접속하고 있는 호스트 사용자만 반환합니다.     |
| isShared              | get    | boolean                                                                                                   | 공유 중인 상태인지 반환합니다.                |
