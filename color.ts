
export const hsvToRgb = (H: number, S: number, V: number) => {
    const
        C = V * S,
        Hp = H / 60,
        X = C * (1 - Math.abs(Hp % 2 - 1))

    let R = 0, G = 0, B = 0
    if (0 <= Hp && Hp < 1) { R = C; G = X; B = 0 }
    if (1 <= Hp && Hp < 2) { R = X; G = C; B = 0 }
    if (2 <= Hp && Hp < 3) { R = 0; G = C; B = X }
    if (3 <= Hp && Hp < 4) { R = 0; G = X; B = C }
    if (4 <= Hp && Hp < 5) { R = X; G = 0; B = C }
    if (5 <= Hp && Hp < 6) { R = C; G = 0; B = X }

    const m = V - C
    R += m
    G += m
    B += m

    R = (R * 255) | 0
    G = (G * 255) | 0
    B = (B * 255) | 0

    return [R, G, B]
}
