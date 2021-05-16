import { kind, cast, equals } from "../types"
import * as String from "../string"
import { unreachable } from "../types"
import { recursiveKey, unwrapRecursiveObject } from "../recursive-object"
import { RangeKind } from "./scanner"
import * as Array from "../array"
import { UnitsDiagnosticKind } from "./parser"
import { UnitsViewKind } from "../../type-safe-units"


interface CharInfo {
    readingMessages: string[]
    sourceChar: string
    trailingMessages: string[]
}
type MessageBufferKind = CharInfo[]

type createMessageBuffer<source extends string> = kind<MessageBufferKind,
    String.toChars<source> extends kind<string[], infer sourceChars>
    ? [
        ...{ [i in keyof sourceChars]: { readingMessages: [], sourceChar: sourceChars[i], trailingMessages: [] } },

        // 診断位置は `ソースの終わりのインデックス + 1` を示すことがある
        { readingMessages: [], sourceChar: "", trailingMessages: [] }
    ]
    : unreachable
>
type messageBufferToString<buffer extends MessageBufferKind> =
    { [i in keyof buffer]:
        buffer[i] extends kind<CharInfo, infer char>
        ? `${String.join<char["readingMessages"], "">}${char["sourceChar"]}${String.join<char["trailingMessages"], "">}`
        : unreachable
    } extends kind<string[], infer messages>
    ? String.join<messages, "">
    : unreachable

type putCharInfo<buffer extends MessageBufferKind, index extends number, info extends CharInfo> = kind<MessageBufferKind,
    { [i in keyof buffer]:
        i extends `${index}`
        ? info
        : buffer[i]
    }
>
type insertReadingMessage<buffer extends MessageBufferKind, index extends number, message extends string> = putCharInfo<buffer, index, {
    readingMessages: [...buffer[index]["readingMessages"], message]
    sourceChar: buffer[index]["sourceChar"]
    trailingMessages: buffer[index]["trailingMessages"]
}>
type insertTrailingMessage<buffer extends MessageBufferKind, index extends number, message extends string> = putCharInfo<buffer, index, {
    readingMessages: buffer[index]["readingMessages"]
    sourceChar: buffer[index]["sourceChar"]
    trailingMessages: [...buffer[index]["trailingMessages"], message]
}>

type asciiChars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
type unicodeBolds = ["𝟬", "𝟭", "𝟮", "𝟯", "𝟰", "𝟱", "𝟲", "𝟳", "𝟴", "𝟵", "𝗮", "𝗯", "𝗰", "𝗱", "𝗲", "𝗳", "𝗴", "𝗵", "𝗶", "𝗷", "𝗸", "𝗹", "𝗺", "𝗻", "𝗼", "𝗽", "𝗾", "𝗿", "𝘀", "𝘁", "𝘂", "𝘃", "𝘄", "𝘅", "𝘆", "𝘇", "𝗔", "𝗕", "𝗖", "𝗗", "𝗘", "𝗙", "𝗚", "𝗛", "𝗜", "𝗝", "𝗞", "𝗟", "𝗠", "𝗡", "𝗢", "𝗣", "𝗤", "𝗥", "𝗦", "𝗧", "𝗨", "𝗩", "𝗪", "𝗫", "𝗬", "𝗭"]

type CharRow = [char: string, boldChar: string]
interface CharTableEntry { bold: string }
interface CharTable { [char: string]: CharTableEntry }
type charRowsToTable<rows extends CharRow[], result extends CharTable> =
    rows extends [kind<CharRow, infer row>, ...kind<CharRow[], infer rest>]
    ? { [recursiveKey]: charRowsToTable<rest, result & { [k in row[0]]: { bold: row[1] } }> }
    : result

type charTable = unwrapRecursiveObject<charRowsToTable<
    Array.zip<String.toChars<asciiChars>, unicodeBolds>,
    Record<never, never>
>>

type charToBold<char extends string> =
    char extends keyof charTable
    ? charTable[char]["bold"]
    : char

type toBold<source extends string> =
    String.toChars<source> extends kind<string[], infer chars>
    ? String.join<{ [i in keyof chars]: charToBold<cast<string, chars[i]>> }, "">
    : unreachable

type insertMessage<buffer extends MessageBufferKind, range extends RangeKind, message extends string> =
    equals<range["start"], range["end"]> extends true
    ? insertReadingMessage<buffer, range["end"], `🕳👈❮${toBold<message>}❯`>
    : insertTrailingMessage<buffer, range["end"], `👈❮${toBold<message>}❯`>

type pushMessages<remaining extends UnitsDiagnosticKind[], buffer extends MessageBufferKind> =
    remaining extends [kind<UnitsDiagnosticKind, infer diagnostic>, ...kind<UnitsDiagnosticKind[], infer remaining2>]
    ? pushMessages<
        remaining2,
        insertMessage<buffer, diagnostic["range"], diagnostic["message"]>
    >
    : buffer

/** @internal */
export type buildErrorMessage<source extends UnitsViewKind, diagnostics extends UnitsDiagnosticKind[]> =
    messageBufferToString<pushMessages<diagnostics, createMessageBuffer<source>>>
