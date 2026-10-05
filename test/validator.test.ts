import { describe, expect, expectTypeOf, it } from "vitest";
import * as v from "../src/validator.js";

describe("primitives", () => {
	it("string", () => {
		expect(v.is(v.string(), "hello")).toBe(true);
		expect(v.is(v.string(), "")).toBe(true);
		expect(v.is(v.string(), 1)).toBe(false);
		expect(v.is(v.string(), undefined)).toBe(false);
	});

	it("number", () => {
		expect(v.is(v.number(), 0)).toBe(true);
		expect(v.is(v.number(), -1.5)).toBe(true);
		expect(v.is(v.number(), Infinity)).toBe(true);
		expect(v.is(v.number(), NaN)).toBe(false);
		expect(v.is(v.number(), "1")).toBe(false);
		expect(v.is(v.number(), 1n)).toBe(false);
	});

	it("boolean", () => {
		expect(v.is(v.boolean(), true)).toBe(true);
		expect(v.is(v.boolean(), false)).toBe(true);
		expect(v.is(v.boolean(), 0)).toBe(false);
	});

	it("bigint", () => {
		expect(v.is(v.bigint(), 1n)).toBe(true);
		expect(v.is(v.bigint(), 1)).toBe(false);
	});

	it("symbol", () => {
		expect(v.is(v.symbol(), Symbol("x"))).toBe(true);
		expect(v.is(v.symbol(), "x")).toBe(false);
	});

	it("function_", () => {
		expect(v.is(v.function_(), () => {})).toBe(true);
		expect(v.is(v.function_(), class {})).toBe(true);
		expect(v.is(v.function_(), {})).toBe(false);
	});

	it("any", () => {
		for (const input of [undefined, null, 0, "", {}, []]) {
			expect(v.is(v.any(), input)).toBe(true);
		}
	});

	it("never", () => {
		for (const input of [undefined, null, 0, "", {}, []]) {
			expect(v.is(v.never(), input)).toBe(false);
		}
	});
});

describe("literal", () => {
	it("matches with Object.is semantics", () => {
		expect(v.is(v.literal("a"), "a")).toBe(true);
		expect(v.is(v.literal("a"), "b")).toBe(false);
		expect(v.is(v.literal(1), 1)).toBe(true);
		expect(v.is(v.literal(0), -0)).toBe(false);
		expect(v.is(v.literal(null), null)).toBe(true);
		expect(v.is(v.literal(null), undefined)).toBe(false);
		expect(v.is(v.literal(undefined), undefined)).toBe(true);
	});

	it("reports the expected value", () => {
		expect(() => v.assert(v.literal("a"), "b")).toThrow(
			"input must be the literal value a",
		);
	});
});

describe("picklist", () => {
	const schema = v.picklist(["a", "b", 1]);

	it("accepts listed values", () => {
		expect(v.is(schema, "a")).toBe(true);
		expect(v.is(schema, 1)).toBe(true);
	});

	it("rejects other values", () => {
		expect(v.is(schema, "c")).toBe(false);
		expect(() => v.assert(schema, "c")).toThrow("input must be one of a, b, 1");
	});
});

describe("optional / nullable / nullish", () => {
	it("optional", () => {
		const schema = v.optional(v.string());
		expect(v.is(schema, undefined)).toBe(true);
		expect(v.is(schema, "a")).toBe(true);
		expect(v.is(schema, null)).toBe(false);
	});

	it("nullable", () => {
		const schema = v.nullable(v.string());
		expect(v.is(schema, null)).toBe(true);
		expect(v.is(schema, "a")).toBe(true);
		expect(v.is(schema, undefined)).toBe(false);
	});

	it("nullish", () => {
		const schema = v.nullish(v.string());
		expect(v.is(schema, null)).toBe(true);
		expect(v.is(schema, undefined)).toBe(true);
		expect(v.is(schema, "a")).toBe(true);
		expect(v.is(schema, 1)).toBe(false);
	});
});

describe("array", () => {
	const schema = v.array(v.string());

	it("accepts arrays of matching items", () => {
		expect(v.is(schema, [])).toBe(true);
		expect(v.is(schema, ["a", "b"])).toBe(true);
	});

	it("rejects non-arrays and bad items", () => {
		expect(v.is(schema, "a")).toBe(false);
		expect(v.is(schema, ["a", 1])).toBe(false);
	});

	it("reports the failing index", () => {
		expect(() => v.assert(schema, ["a", 1])).toThrow(
			"input[1] must be a string",
		);
	});
});

describe("object", () => {
	const schema = v.object({
		name: v.string(),
		age: v.optional(v.number()),
	});

	it("accepts matching objects", () => {
		expect(v.is(schema, { name: "a" })).toBe(true);
		expect(v.is(schema, { name: "a", age: 1 })).toBe(true);
		expect(v.is(schema, { name: "a", extra: true })).toBe(true);
	});

	it("rejects non-objects", () => {
		expect(v.is(schema, null)).toBe(false);
		expect(v.is(schema, "a")).toBe(false);
	});

	it("reports nested paths", () => {
		const nested = v.object({ a: v.object({ b: v.array(v.number()) }) });
		expect(() => v.assert(nested, { a: { b: [1, "x"] } })).toThrow(
			"input[a][b][1] must be a number",
		);
	});

	it("infers optional keys", () => {
		expectTypeOf<v.Infer<typeof schema>>().toEqualTypeOf<{
			name: string;
			age?: number | undefined;
		}>();
	});
});

describe("objectWithRest", () => {
	const schema = v.objectWithRest({ id: v.number() }, v.string());

	it("validates known keys and rest", () => {
		expect(v.is(schema, { id: 1 })).toBe(true);
		expect(v.is(schema, { id: 1, a: "x" })).toBe(true);
		expect(v.is(schema, { id: "1" })).toBe(false);
		expect(() => v.assert(schema, { id: 1, a: 2 })).toThrow(
			"input[a] must be a string",
		);
	});
});

describe("strictObject", () => {
	const schema = v.strictObject({ id: v.number() });

	it("rejects unknown keys", () => {
		expect(v.is(schema, { id: 1 })).toBe(true);
		expect(() => v.assert(schema, { id: 1, extra: 1 })).toThrow(
			"input[extra] must be omitted",
		);
	});
});

describe("record", () => {
	const schema = v.record(v.picklist(["a", "b"]), v.number());

	it("validates keys and values", () => {
		expect(v.is(schema, {})).toBe(true);
		expect(v.is(schema, { a: 1, b: 2 })).toBe(true);
		expect(v.is(schema, { c: 1 })).toBe(false);
		expect(v.is(schema, { a: "1" })).toBe(false);
		expect(v.is(schema, null)).toBe(false);
	});
});

describe("tuple", () => {
	const schema = v.tuple([v.string(), v.number()]);

	it("validates positional items", () => {
		expect(v.is(schema, ["a", 1])).toBe(true);
		expect(v.is(schema, [1, "a"])).toBe(false);
		expect(v.is(schema, ["a"])).toBe(false);
		expect(v.is(schema, {})).toBe(false);
	});

	it("infers a tuple type", () => {
		expectTypeOf<v.Infer<typeof schema>>().toEqualTypeOf<[string, number]>();
	});
});

describe("tupleWithRest", () => {
	const schema = v.tupleWithRest([v.literal("a"), v.literal("b")], v.number());

	it("validates leading items and rest", () => {
		expect(v.is(schema, ["a", "b"])).toBe(true);
		expect(v.is(schema, ["a", "b", 1, 2])).toBe(true);
		expect(v.is(schema, ["a"])).toBe(false);
		expect(() => v.assert(schema, ["a", "b", 1, "x"])).toThrow(
			"input[3] must be a number",
		);
	});

	it("infers a variadic tuple type", () => {
		expectTypeOf<v.Infer<typeof schema>>().toEqualTypeOf<
			["a", "b", ...number[]]
		>();
	});
});

describe("instance", () => {
	it("checks instanceof", () => {
		const schema = v.instance(Date);
		expect(v.is(schema, new Date())).toBe(true);
		expect(v.is(schema, Date.now())).toBe(false);
		expect(() => v.assert(schema, {})).toThrow(
			"input must be an instance of Date",
		);
	});
});

describe("set", () => {
	const schema = v.set(v.number());

	it("validates Set members", () => {
		expect(v.is(schema, new Set())).toBe(true);
		expect(v.is(schema, new Set([1, 2]))).toBe(true);
		expect(v.is(schema, new Set([1, "2"]))).toBe(false);
		expect(v.is(schema, [1, 2])).toBe(false);
		expect(() => v.assert(schema, new Set([1, "x"]))).toThrow(
			"input[(value at index 1)] must be a number",
		);
	});

	it("reports nested paths within members", () => {
		const nested = v.set(v.object({ name: v.string() }));
		expect(() =>
			v.assert(nested, new Set([{ name: "a" }, { name: 1 }])),
		).toThrow("input[(value at index 1)][name] must be a string");
	});
});

describe("map", () => {
	const schema = v.map(v.string(), v.number());

	it("validates Map entries", () => {
		expect(v.is(schema, new Map())).toBe(true);
		expect(v.is(schema, new Map([["a", 1]]))).toBe(true);
		expect(v.is(schema, new Map([[1, 1]]))).toBe(false);
		expect(v.is(schema, new Map([["a", "1"]]))).toBe(false);
		expect(v.is(schema, {})).toBe(false);
	});

	it("reports whether the key or the value failed", () => {
		const input = (entry: [unknown, unknown]) =>
			new Map<unknown, unknown>([["a", 1], entry]);
		expect(() => v.assert(schema, input([1, 1]))).toThrow(
			"input[(key at index 1)] must be a string",
		);
		expect(() => v.assert(schema, input(["b", "1"]))).toThrow(
			"input[(value at index 1)] must be a number",
		);
	});
});

describe("assert", () => {
	it("does not throw for valid input", () => {
		expect(() => v.assert(v.string(), "a")).not.toThrow();
	});

	it("throws a TypeError for invalid input", () => {
		expect(() => v.assert(v.string(), 1)).toThrow(TypeError);
		expect(() => v.assert(v.string(), 1)).toThrow("input must be a string");
	});

	it("narrows the input type", () => {
		const input: unknown = { a: 1 };
		v.assert(v.object({ a: v.number() }), input);
		expectTypeOf(input).toEqualTypeOf<{ a: number }>();
	});
});
