export interface BoxCreateOptions {
    x: number
    y: number
    width: number
    height: number
    position?: undefined
    size?: undefined
}
export class Box {
    readonly x
    readonly y
    readonly width
    readonly height
    constructor(x: number, y: number, width: number, height: number) {
        this.x = x
        this.y = y
        this.width = width
        this.height = height
    }
    static create(options: BoxCreateOptions) {
        const { x, y, width, height } = options
        return new this(x, y, width, height)
    }

    /**
     * この Box を上と下に分割する。
     * @param topHeight 上の Box の高さ
     */
    splitTop(topHeight: number): [top: Box, bottom: Box] {
        return [
            new Box(this.x, this.y, this.width, topHeight),
            new Box(this.x, this.y + topHeight, this.width, this.height - topHeight)
        ]
    }
    /**
     * この Box を上と下に分割する。
     * @param bottomHeight 下の Box の高さ
     */
    splitBottom(bottomHeight: number): [top: Box, bottom: Box] {
        return [
            new Box(this.x, this.y, this.width, this.height - bottomHeight),
            new Box(this.x, this.y + (this.height - bottomHeight), this.width, bottomHeight)
        ]
    }
    /**
     * この Box を左と右に分割する
     * @param leftWidth 左の Box の幅
     */
    splitLeft(leftWidth: number): [left: Box, right: Box] {
        return [
            new Box(this.x, this.y, leftWidth, this.height),
            new Box(this.x + leftWidth, this.y, this.width - leftWidth, this.height)
        ]
    }
    /**
     * この Box を左と右に分割する
     * @param rightWidth 右の Box の幅
     */
    splitRight(rightWidth: number): [left: Box, right: Box] {
        return [
            new Box(this.x, this.y, this.width - rightWidth, this.height),
            new Box(this.x + (this.width - rightWidth), this.y, rightWidth, this.height)
        ]
    }
}
