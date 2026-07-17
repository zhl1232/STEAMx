export const FUNCTION_EXPRESSION_MAX_LENGTH = 256
export const FUNCTION_EXPRESSION_MAX_TOKENS = 192
export const FUNCTION_EXPRESSION_MAX_DEPTH = 48

export type FunctionPlotterErrorCode =
    | "empty_expression"
    | "input_too_long"
    | "too_many_tokens"
    | "invalid_character"
    | "invalid_number"
    | "unexpected_token"
    | "unexpected_end"
    | "unknown_identifier"
    | "function_parentheses_required"
    | "max_depth_exceeded"

export type FunctionPlotterError = {
    code: FunctionPlotterErrorCode
    message: string
    position: number
}

export type FunctionAst =
    | { type: "number"; value: number; constant?: FunctionConstant }
    | { type: "variable" }
    | { type: "unary"; operator: "+" | "-"; argument: FunctionAst }
    | { type: "binary"; operator: "+" | "-" | "*" | "/" | "^"; left: FunctionAst; right: FunctionAst }
    | { type: "call"; name: FunctionName; argument: FunctionAst }

export type FunctionName =
    | "sin"
    | "cos"
    | "tan"
    | "abs"
    | "sqrt"
    | "log"
    | "exp"
    | "floor"
    | "ceil"
    | "round"

export type FunctionConstant = "pi" | "e"

export type ParsedFunction = {
    source: string
    ast: FunctionAst
    tokenCount: number
    functions: FunctionName[]
    constants: FunctionConstant[]
}

export type ParseFunctionResult =
    | { ok: true; parsed: ParsedFunction }
    | { ok: false; error: FunctionPlotterError }

export type FunctionEvaluationErrorCode =
    | "invalid_x"
    | "division_by_zero"
    | "domain_error"
    | "non_finite"

export type FunctionEvaluation =
    | { ok: true; value: number }
    | { ok: false; code: FunctionEvaluationErrorCode; message: string }

export type FunctionPlotSample = {
    x: number
    y: number
}

export type FunctionPlotTerminationKind =
    | "completed"
    | "domain_error"
    | "non_finite"
    | "out_of_range"
    | "discontinuity"
    | "sample_limit"

export type FunctionPlotTermination = {
    kind: FunctionPlotTerminationKind
    x: number
    message?: string
}

export type FunctionPlotResult = {
    samples: FunctionPlotSample[]
    termination: FunctionPlotTermination
}

export type FunctionPlotOptions = {
    startX: number
    endX: number
    step?: number
    yOffset?: number
    yScale?: number
    maxAbsY?: number
    discontinuityThreshold?: number
    maxSamples?: number
}

type Token =
    | { type: "number"; value: number; position: number }
    | { type: "identifier"; value: string; position: number }
    | { type: "operator"; value: "+" | "-" | "*" | "/" | "^"; position: number }
    | { type: "leftParen"; position: number }
    | { type: "rightParen"; position: number }
    | { type: "eof"; position: number }

const FUNCTION_IMPLEMENTATIONS: Record<FunctionName, (value: number) => number> = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    abs: Math.abs,
    sqrt: Math.sqrt,
    log: Math.log,
    exp: Math.exp,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
}

const FUNCTION_NAMES = new Set<FunctionName>(Object.keys(FUNCTION_IMPLEMENTATIONS) as FunctionName[])
const DISCONTINUITY_PROBE_SEGMENTS = 8
const TANGENT_POLE_EPSILON = 1e-10

class PlotterSyntaxError extends Error {
    readonly detail: FunctionPlotterError

    constructor(code: FunctionPlotterErrorCode, message: string, position: number) {
        super(message)
        this.name = "PlotterSyntaxError"
        this.detail = { code, message, position }
    }
}

function normalizeExpression(source: string): string {
    return source
        .replaceAll("−", "-")
        .replace(/[×·]/g, "*")
        .replaceAll("÷", "/")
        .replaceAll("π", "pi")
}

function isDigit(character: string | undefined): boolean {
    return character !== undefined && character >= "0" && character <= "9"
}

function isIdentifierStart(character: string | undefined): boolean {
    return character !== undefined && /[A-Za-z]/.test(character)
}

function tokenize(source: string): Token[] {
    const tokens: Token[] = []
    let position = 0

    const push = (token: Token) => {
        if (token.type !== "eof" && tokens.length >= FUNCTION_EXPRESSION_MAX_TOKENS) {
            throw new PlotterSyntaxError(
                "too_many_tokens",
                `表达式最多允许 ${FUNCTION_EXPRESSION_MAX_TOKENS} 个符号`,
                token.position,
            )
        }
        tokens.push(token)
    }

    while (position < source.length) {
        const character = source[position]
        if (/\s/.test(character)) {
            position += 1
            continue
        }

        if (isDigit(character) || (character === "." && isDigit(source[position + 1]))) {
            const start = position
            let sawDigit = false

            while (isDigit(source[position])) {
                sawDigit = true
                position += 1
            }
            if (source[position] === ".") {
                position += 1
                while (isDigit(source[position])) {
                    sawDigit = true
                    position += 1
                }
            }

            if (!sawDigit) {
                throw new PlotterSyntaxError("invalid_number", "数字格式无效", start)
            }

            if (
                (source[position] === "e" || source[position] === "E") &&
                (isDigit(source[position + 1]) ||
                    ((source[position + 1] === "+" || source[position + 1] === "-") && isDigit(source[position + 2])))
            ) {
                position += 1
                if (source[position] === "+" || source[position] === "-") position += 1
                while (isDigit(source[position])) position += 1
            }

            const raw = source.slice(start, position)
            const value = Number(raw)
            if (!Number.isFinite(value)) {
                throw new PlotterSyntaxError("invalid_number", `数字 “${raw}” 超出范围`, start)
            }
            push({ type: "number", value, position: start })
            continue
        }

        if (isIdentifierStart(character)) {
            const start = position
            position += 1
            while (isIdentifierStart(source[position])) position += 1
            push({ type: "identifier", value: source.slice(start, position).toLowerCase(), position: start })
            continue
        }

        if (character === "+" || character === "-" || character === "*" || character === "/" || character === "^") {
            push({ type: "operator", value: character, position })
            position += 1
            continue
        }
        if (character === "(") {
            push({ type: "leftParen", position })
            position += 1
            continue
        }
        if (character === ")") {
            push({ type: "rightParen", position })
            position += 1
            continue
        }

        throw new PlotterSyntaxError("invalid_character", `不支持字符 “${character}”`, position)
    }

    push({ type: "eof", position: source.length })
    return tokens
}

class Parser {
    private index = 0

    constructor(private readonly tokens: Token[]) {}

    parse(): FunctionAst {
        const ast = this.parseAdditive(0)
        const token = this.peek()
        if (token.type !== "eof") {
            throw new PlotterSyntaxError("unexpected_token", `意外的符号 “${this.describe(token)}”`, token.position)
        }
        return ast
    }

    private parseAdditive(depth: number): FunctionAst {
        this.checkDepth(depth)
        let left = this.parseMultiplicative(depth)
        while (this.isOperator("+") || this.isOperator("-")) {
            const operator = (this.take() as Extract<Token, { type: "operator" }>).value as "+" | "-"
            const right = this.parseMultiplicative(depth)
            left = { type: "binary", operator, left, right }
        }
        return left
    }

    private parseMultiplicative(depth: number): FunctionAst {
        let left = this.parseUnary(depth)
        for (;;) {
            if (this.isOperator("*") || this.isOperator("/")) {
                const operator = (this.take() as Extract<Token, { type: "operator" }>).value as "*" | "/"
                const right = this.parseUnary(depth)
                left = { type: "binary", operator, left, right }
                continue
            }
            if (this.startsImplicitFactor(this.peek())) {
                const right = this.parseUnary(depth)
                left = { type: "binary", operator: "*", left, right }
                continue
            }
            return left
        }
    }

    private parseUnary(depth: number): FunctionAst {
        this.checkDepth(depth)
        if (this.isOperator("+") || this.isOperator("-")) {
            const operator = (this.take() as Extract<Token, { type: "operator" }>).value as "+" | "-"
            return { type: "unary", operator, argument: this.parseUnary(depth + 1) }
        }
        return this.parsePower(depth)
    }

    private parsePower(depth: number): FunctionAst {
        let left = this.parsePrimary(depth)
        if (this.isOperator("^")) {
            this.take()
            const right = this.parseUnary(depth + 1)
            left = { type: "binary", operator: "^", left, right }
        }
        return left
    }

    private parsePrimary(depth: number): FunctionAst {
        this.checkDepth(depth)
        const token = this.take()
        if (token.type === "number") return { type: "number", value: token.value }

        if (token.type === "identifier") {
            if (token.value === "x") return { type: "variable" }
            if (token.value === "pi") return { type: "number", value: Math.PI, constant: "pi" }
            if (token.value === "e") return { type: "number", value: Math.E, constant: "e" }
            if (!FUNCTION_NAMES.has(token.value as FunctionName)) {
                throw new PlotterSyntaxError("unknown_identifier", `未知变量或函数 “${token.value}”`, token.position)
            }
            if (this.peek().type !== "leftParen") {
                throw new PlotterSyntaxError(
                    "function_parentheses_required",
                    `函数 ${token.value} 需要使用括号，例如 ${token.value}(x)`,
                    token.position,
                )
            }
            this.take()
            const argument = this.parseAdditive(depth + 1)
            const closing = this.take()
            if (closing.type !== "rightParen") {
                throw new PlotterSyntaxError("unexpected_token", "缺少右括号", closing.position)
            }
            return { type: "call", name: token.value as FunctionName, argument }
        }

        if (token.type === "leftParen") {
            const expression = this.parseAdditive(depth + 1)
            const closing = this.take()
            if (closing.type !== "rightParen") {
                throw new PlotterSyntaxError("unexpected_token", "缺少右括号", closing.position)
            }
            return expression
        }

        if (token.type === "eof") {
            throw new PlotterSyntaxError("unexpected_end", "表达式意外结束", token.position)
        }
        throw new PlotterSyntaxError("unexpected_token", `意外的符号 “${this.describe(token)}”`, token.position)
    }

    private startsImplicitFactor(token: Token): boolean {
        return token.type === "identifier" || token.type === "leftParen"
    }

    private isOperator(operator: Extract<Token, { type: "operator" }>["value"]): boolean {
        const token = this.peek()
        return token.type === "operator" && token.value === operator
    }

    private checkDepth(depth: number): void {
        if (depth > FUNCTION_EXPRESSION_MAX_DEPTH) {
            throw new PlotterSyntaxError(
                "max_depth_exceeded",
                `表达式嵌套不能超过 ${FUNCTION_EXPRESSION_MAX_DEPTH} 层`,
                this.peek().position,
            )
        }
    }

    private peek(): Token {
        return this.tokens[this.index]
    }

    private take(): Token {
        const token = this.peek()
        if (token.type !== "eof") this.index += 1
        return token
    }

    private describe(token: Token): string {
        if (token.type === "operator" || token.type === "identifier") return token.value
        if (token.type === "number") return String(token.value)
        if (token.type === "leftParen") return "("
        if (token.type === "rightParen") return ")"
        return "表达式末尾"
    }
}

export function parseFunctionExpression(input: string): ParseFunctionResult {
    const source = normalizeExpression(input.trim())
    if (source.length === 0) {
        return {
            ok: false,
            error: { code: "empty_expression", message: "请输入函数表达式", position: 0 },
        }
    }
    if (source.length > FUNCTION_EXPRESSION_MAX_LENGTH) {
        return {
            ok: false,
            error: {
                code: "input_too_long",
                message: `表达式最多允许 ${FUNCTION_EXPRESSION_MAX_LENGTH} 个字符`,
                position: FUNCTION_EXPRESSION_MAX_LENGTH,
            },
        }
    }

    try {
        const tokens = tokenize(source)
        const ast = new Parser(tokens).parse()
        const functions = new Set<FunctionName>()
        const constants = new Set<FunctionConstant>()
        const visit = (node: FunctionAst): void => {
            if (node.type === "number") {
                if (node.constant) constants.add(node.constant)
                return
            }
            if (node.type === "variable") return
            if (node.type === "unary") {
                visit(node.argument)
                return
            }
            if (node.type === "binary") {
                visit(node.left)
                visit(node.right)
                return
            }
            functions.add(node.name)
            visit(node.argument)
        }
        visit(ast)
        return {
            ok: true,
            parsed: {
                source,
                ast,
                tokenCount: tokens.length - 1,
                functions: [...functions],
                constants: [...constants],
            },
        }
    } catch (error) {
        if (error instanceof PlotterSyntaxError) return { ok: false, error: error.detail }
        return {
            ok: false,
            error: { code: "unexpected_token", message: "表达式解析失败", position: 0 },
        }
    }
}

function evaluateAst(ast: FunctionAst, x: number): FunctionEvaluation {
    switch (ast.type) {
        case "number":
            return { ok: true, value: ast.value }
        case "variable":
            return { ok: true, value: x }
        case "unary": {
            const argument = evaluateAst(ast.argument, x)
            if (!argument.ok) return argument
            const value = ast.operator === "-" ? -argument.value : argument.value
            return Number.isFinite(value)
                ? { ok: true, value }
                : { ok: false, code: "non_finite", message: "函数结果超出可计算范围" }
        }
        case "binary": {
            const left = evaluateAst(ast.left, x)
            if (!left.ok) return left
            const right = evaluateAst(ast.right, x)
            if (!right.ok) return right

            if (ast.operator === "/" && right.value === 0) {
                return { ok: false, code: "division_by_zero", message: "除数不能为 0" }
            }

            let value: number
            switch (ast.operator) {
                case "+":
                    value = left.value + right.value
                    break
                case "-":
                    value = left.value - right.value
                    break
                case "*":
                    value = left.value * right.value
                    break
                case "/":
                    value = left.value / right.value
                    break
                case "^":
                    value = left.value ** right.value
                    break
            }
            if (Number.isNaN(value)) {
                return { ok: false, code: "domain_error", message: "函数在这个位置没有实数结果" }
            }
            return Number.isFinite(value)
                ? { ok: true, value }
                : { ok: false, code: "non_finite", message: "函数结果超出可计算范围" }
        }
        case "call": {
            const argument = evaluateAst(ast.argument, x)
            if (!argument.ok) return argument
            if (ast.name === "sqrt" && argument.value < 0) {
                return { ok: false, code: "domain_error", message: "sqrt 的参数不能小于 0" }
            }
            if (ast.name === "log" && argument.value <= 0) {
                return { ok: false, code: "domain_error", message: "log 的参数必须大于 0" }
            }
            if (ast.name === "tan" && isTangentPole(argument.value)) {
                return { ok: false, code: "domain_error", message: "tan 在这个位置没有定义" }
            }
            const value = FUNCTION_IMPLEMENTATIONS[ast.name](argument.value)
            if (Number.isNaN(value)) {
                return { ok: false, code: "domain_error", message: `${ast.name} 在这个位置没有实数结果` }
            }
            return Number.isFinite(value)
                ? { ok: true, value }
                : { ok: false, code: "non_finite", message: `${ast.name} 的结果超出可计算范围` }
        }
    }
}

export function evaluateFunction(parsedOrAst: ParsedFunction | FunctionAst, x: number): FunctionEvaluation {
    if (!Number.isFinite(x)) {
        return { ok: false, code: "invalid_x", message: "x 必须是有限数字" }
    }
    const ast = "ast" in parsedOrAst ? parsedOrAst.ast : parsedOrAst
    return evaluateAst(ast, x)
}

export function evaluateFunctionExpression(source: string, x: number): FunctionEvaluation | { ok: false; error: FunctionPlotterError } {
    const parsed = parseFunctionExpression(source)
    if (!parsed.ok) return parsed
    return evaluateFunction(parsed.parsed, x)
}

function isTangentPole(value: number): boolean {
    return Number.isFinite(value) && Math.abs(Math.cos(value)) <= TANGENT_POLE_EPSILON
}

function intervalCrossesTangentPole(first: number, second: number): boolean {
    if (!Number.isFinite(first) || !Number.isFinite(second)) return true
    if (first === second) return isTangentPole(first)
    const low = Math.min(first, second)
    const high = Math.max(first, second)
    const offset = Math.PI / 2
    const period = Math.PI
    const firstPoleIndex = Math.ceil((low - offset) / period)
    const pole = offset + firstPoleIndex * period
    return pole >= low - TANGENT_POLE_EPSILON && pole <= high + TANGENT_POLE_EPSILON
}

function fullExpressionHasStepJump(ast: FunctionAst, x: number, intervalSpan: number): boolean {
    const coordinateScale = Math.max(1, Math.abs(x))
    const epsilon = Math.max(
        intervalSpan * 1e-5,
        Number.EPSILON * coordinateScale * 64,
    )
    const leftOuter = evaluateAst(ast, x - epsilon * 2)
    const leftInner = evaluateAst(ast, x - epsilon)
    const rightInner = evaluateAst(ast, x + epsilon)
    const rightOuter = evaluateAst(ast, x + epsilon * 2)
    if (!leftOuter.ok || !leftInner.ok || !rightInner.ok || !rightOuter.ok) return true

    // Extrapolate each smooth side to the transition so steep continuous terms cancel out.
    const leftLimit = leftInner.value * 2 - leftOuter.value
    const rightLimit = rightInner.value * 2 - rightOuter.value
    if (!Number.isFinite(leftLimit) || !Number.isFinite(rightLimit)) return true

    const scale = Math.max(1, Math.abs(leftLimit), Math.abs(rightLimit))
    const tolerance = Math.max(1e-9, Number.EPSILON * scale * 128)
    return Math.abs(rightLimit - leftLimit) > tolerance
}

function findKnownDiscontinuity(ast: FunctionAst, startX: number, endX: number): number | null {
    let earliestProgress = Number.POSITIVE_INFINITY
    const mark = (progress: number) => {
        earliestProgress = Math.min(earliestProgress, Math.max(0, Math.min(1, progress)))
    }

    const visit = (node: FunctionAst): void => {
        switch (node.type) {
            case "number":
            case "variable":
                return
            case "unary":
                visit(node.argument)
                return
            case "binary": {
                if (node.operator === "/") {
                    let previousValue: number | null = null
                    let previousProgress = 0
                    for (let index = 0; index <= DISCONTINUITY_PROBE_SEGMENTS; index += 1) {
                        const progress = index / DISCONTINUITY_PROBE_SEGMENTS
                        const x = startX + (endX - startX) * progress
                        const denominator = evaluateAst(node.right, x)
                        if (!denominator.ok || denominator.value === 0) {
                            mark(progress)
                            previousValue = null
                            previousProgress = progress
                            continue
                        }
                        if (
                            previousValue !== null &&
                            ((previousValue < 0 && denominator.value > 0) ||
                                (previousValue > 0 && denominator.value < 0))
                        ) {
                            mark((previousProgress + progress) / 2)
                        }
                        previousValue = denominator.value
                        previousProgress = progress
                    }
                }
                visit(node.left)
                visit(node.right)
                return
            }
            case "call": {
                if (node.name === "tan" || node.name === "floor" || node.name === "ceil" || node.name === "round") {
                    let previousValue: number | null = null
                    let previousProgress = 0
                    for (let index = 0; index <= DISCONTINUITY_PROBE_SEGMENTS; index += 1) {
                        const progress = index / DISCONTINUITY_PROBE_SEGMENTS
                        const x = startX + (endX - startX) * progress
                        const argument = evaluateAst(node.argument, x)
                        if (!argument.ok) {
                            mark(progress)
                            previousValue = null
                            previousProgress = progress
                            continue
                        }

                        if (node.name === "tan") {
                            if (isTangentPole(argument.value)) mark(progress)
                            if (
                                previousValue !== null &&
                                intervalCrossesTangentPole(previousValue, argument.value)
                            ) {
                                mark((previousProgress + progress) / 2)
                            }
                        } else {
                            const value = FUNCTION_IMPLEMENTATIONS[node.name](argument.value)
                            if (previousValue !== null && value !== previousValue) {
                                let lowerProgress = previousProgress
                                let upperProgress = progress
                                const lowerValue = previousValue
                                for (let refinement = 0; refinement < 40; refinement += 1) {
                                    const midpointProgress = (lowerProgress + upperProgress) / 2
                                    const midpointX = startX + (endX - startX) * midpointProgress
                                    const midpointArgument = evaluateAst(node.argument, midpointX)
                                    if (!midpointArgument.ok) {
                                        upperProgress = midpointProgress
                                        continue
                                    }
                                    const midpointValue = FUNCTION_IMPLEMENTATIONS[node.name](midpointArgument.value)
                                    if (midpointValue === lowerValue) lowerProgress = midpointProgress
                                    else upperProgress = midpointProgress
                                }
                                const transitionProgress = (lowerProgress + upperProgress) / 2
                                const transitionX = startX + (endX - startX) * transitionProgress
                                const intervalSpan = Math.abs(
                                    (endX - startX) * (progress - previousProgress),
                                )
                                if (fullExpressionHasStepJump(ast, transitionX, intervalSpan)) {
                                    mark(transitionProgress)
                                }
                            }
                        }
                        previousValue = argument.value
                        if (node.name !== "tan") {
                            previousValue = FUNCTION_IMPLEMENTATIONS[node.name](argument.value)
                        }
                        previousProgress = progress
                    }
                }
                visit(node.argument)
            }
        }
    }

    visit(ast)
    return Number.isFinite(earliestProgress)
        ? startX + (endX - startX) * earliestProgress
        : null
}

export function isLikelyDiscontinuity(
    previousY: number,
    nextY: number,
    midpoint: FunctionEvaluation,
    threshold = 12,
): boolean {
    if (!midpoint.ok) return true

    const endpointScale = Math.max(1, Math.abs(previousY), Math.abs(nextY))
    const smallerEndpoint = Math.min(Math.abs(previousY), Math.abs(nextY))
    const midpointScale = Math.abs(midpoint.value)
    const linearMidpoint = (previousY + nextY) / 2
    const midpointError = Math.abs(midpoint.value - linearMidpoint)
    const endpointJump = Math.abs(nextY - previousY)

    const midpointSpike = midpointScale > Math.max(threshold, endpointScale * 4)
    const endpointSpike =
        endpointScale > threshold * 4 &&
        endpointJump > threshold * 2 &&
        endpointScale > Math.max(1, smallerEndpoint) * 8 &&
        midpointError > threshold
    const nonlinearBridge = midpointError > threshold && midpointError > endpointScale * 1.5
    const poleSignFlip =
        previousY * nextY < 0 &&
        endpointJump > threshold * 2 &&
        midpointScale > endpointScale * 1.5

    return midpointSpike || endpointSpike || nonlinearBridge || poleSignFlip
}

export function plotFunction(parsedOrAst: ParsedFunction | FunctionAst, options: FunctionPlotOptions): FunctionPlotResult {
    const {
        startX,
        endX,
        step = 0.05,
        yOffset = 0,
        yScale = 1,
        maxAbsY = 1_000_000,
        discontinuityThreshold = 12,
        maxSamples = 4096,
    } = options

    if (
        !Number.isFinite(startX) ||
        !Number.isFinite(endX) ||
        !Number.isFinite(step) ||
        step <= 0 ||
        maxSamples < 1
    ) {
        return {
            samples: [],
            termination: { kind: "domain_error", x: startX, message: "采样范围或步长无效" },
        }
    }

    const direction = endX >= startX ? 1 : -1
    const signedStep = step * direction
    const samples: FunctionPlotSample[] = []
    const ast = "ast" in parsedOrAst ? parsedOrAst.ast : parsedOrAst
    let currentX = startX

    while (samples.length < maxSamples) {
        const reachedEnd = direction > 0 ? currentX >= endX : currentX <= endX
        const sampleX = reachedEnd ? endX : currentX
        const evaluation = evaluateFunction(parsedOrAst, sampleX)
        if (!evaluation.ok) {
            return {
                samples,
                termination: {
                    kind: evaluation.code === "non_finite" ? "non_finite" : "domain_error",
                    x: sampleX,
                    message: evaluation.message,
                },
            }
        }

        const y = yOffset + evaluation.value * yScale
        if (!Number.isFinite(y)) {
            return {
                samples,
                termination: { kind: "non_finite", x: sampleX, message: "函数结果超出可计算范围" },
            }
        }
        if (Math.abs(y) > maxAbsY) {
            return {
                samples,
                termination: { kind: "out_of_range", x: sampleX, message: "函数轨迹超出范围" },
            }
        }

        const previous = samples.at(-1)
        if (previous) {
            const knownDiscontinuity = findKnownDiscontinuity(ast, previous.x, sampleX)
            if (knownDiscontinuity !== null) {
                return {
                    samples,
                    termination: {
                        kind: "discontinuity",
                        x: knownDiscontinuity,
                        message: "函数在这里发生不连续跳变",
                    },
                }
            }
            const midpointX = (previous.x + sampleX) / 2
            const rawMidpoint = evaluateFunction(parsedOrAst, midpointX)
            const midpoint: FunctionEvaluation = rawMidpoint.ok
                ? { ok: true, value: yOffset + rawMidpoint.value * yScale }
                : rawMidpoint
            if (isLikelyDiscontinuity(previous.y, y, midpoint, discontinuityThreshold)) {
                return {
                    samples,
                    termination: { kind: "discontinuity", x: midpointX, message: "函数在这里发生不连续跳变" },
                }
            }
        }

        samples.push({ x: sampleX, y })
        if (reachedEnd) {
            return { samples, termination: { kind: "completed", x: endX } }
        }
        currentX += signedStep
        if (direction > 0 && currentX > endX) currentX = endX
        if (direction < 0 && currentX < endX) currentX = endX
    }

    return {
        samples,
        termination: { kind: "sample_limit", x: samples.at(-1)?.x ?? startX, message: "轨迹采样点过多" },
    }
}
