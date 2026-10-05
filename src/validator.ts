type Issue = {
	readonly expected: string;
	readonly path: Array<string | number | symbol>;
};

type Schema<T = unknown> = ((input: unknown) => Issue | undefined) & {
	readonly _?: { T: T };
};

export type Infer<T extends Schema> = NonNullable<T["_"]>["T"];

type Prettify<T> = { [K in keyof T]: T[K] } & {};

type MarkOptional<T, TKeys extends keyof T> = {
	[TKey in keyof T]?: unknown;
} & Omit<T, TKeys> &
	Partial<Pick<T, TKeys>>;

type OptionalInputKeys<T> = {
	[K in keyof T]: undefined extends T[K] ? K : never;
}[keyof T];

type InputWithQuestionMarks<T> = MarkOptional<T, OptionalInputKeys<T>>;

type ObjectEntries = { [key: string]: Schema };

type InferObjectSchemaType<T extends ObjectEntries> = Prettify<
	InputWithQuestionMarks<{ -readonly [K in keyof T]: Infer<T[K]> }>
>;

type MaybeReadonly<TValue> = TValue | Readonly<TValue>;

type PicklistOptions = MaybeReadonly<(string | number | bigint)[]>;

export function is<S extends Schema>(
	schema: S,
	input: unknown,
): input is Infer<S> {
	return !schema(input);
}

export function assert<const S extends Schema>(
	schema: S,
	input: unknown,
): asserts input is Infer<S> {
	const issue = schema(input);
	if (issue) {
		issue.path.push("input");
		throw new TypeError(
			`${issue.path.reverse().join(".")} must be ${issue.expected}`,
		);
	}
}

export function optional<const S extends Schema>(
	schema: S,
): Schema<Infer<S> | undefined> {
	return (input) => {
		if (input !== undefined) return schema(input);
	};
}

export function nullable<const S extends Schema>(
	schema: S,
): Schema<Infer<S> | null> {
	return (input) => {
		if (input !== null) return schema(input);
	};
}

export function nullish<const S extends Schema>(
	schema: S,
): Schema<Infer<S> | null | undefined> {
	return (input) => {
		if (input !== null && input !== undefined) return schema(input);
	};
}

export function any(): Schema<any> {
	return () => undefined;
}

export function never(): Schema<never> {
	return () => ({ expected: "omitted", path: [] });
}

export function string(): Schema<string> {
	return (input) => {
		if (typeof input !== "string") return { expected: "a string", path: [] };
	};
}

export function number(): Schema<number> {
	return (input) => {
		if (typeof input !== "number" || isNaN(input))
			return { expected: "a number", path: [] };
	};
}

export function boolean(): Schema<boolean> {
	return (input) => {
		if (typeof input !== "boolean") return { expected: "a boolean", path: [] };
	};
}

export function bigint(): Schema<bigint> {
	return (input) => {
		if (typeof input !== "bigint") return { expected: "a bigint", path: [] };
	};
}

export function symbol(): Schema<symbol> {
	return (input) => {
		if (typeof input !== "symbol") return { expected: "a symbol", path: [] };
	};
}

export function function_(): Schema<(...args: unknown[]) => unknown> {
	return (input) => {
		if (typeof input !== "function")
			return { expected: "a function", path: [] };
	};
}

export function array<const Item extends Schema>(
	item: Item,
): Schema<Array<Infer<Item>>> {
	return (input) => {
		if (!Array.isArray(input)) {
			return { expected: "an array", path: [] };
		}
		for (let i = 0; i < input.length; i++) {
			const issue = item(input[i]);
			if (issue) {
				issue.path.push(i);
				return issue;
			}
		}
	};
}

export function object<const T extends ObjectEntries>(
	entries: T,
): Schema<InferObjectSchemaType<T>> {
	return (input) => {
		if (!input || typeof input !== "object") {
			return { expected: "an object", path: [] };
		}
		for (const [key, schema] of Object.entries(entries)) {
			const issue = schema((input as any)[key]);
			if (issue) {
				issue.path.push(key);
				return issue;
			}
		}
	};
}

export function objectWithRest<
	const T extends ObjectEntries,
	const R extends Schema,
>(
	entries: T,
	rest: R,
): Schema<InferObjectSchemaType<T> & { [key: string]: Infer<R> }> {
	return (input) => {
		if (!input || typeof input !== "object") {
			return { expected: "an object", path: [] };
		}
		for (const [key, schema] of Object.entries(entries)) {
			const issue = schema((input as any)[key]);
			if (issue) {
				issue.path.push(key);
				return issue;
			}
		}
		for (const [k, v] of Object.entries(input)) {
			if (entries[k]) continue;
			const issue = rest(v);
			if (issue) {
				issue.path.push(k);
				return issue;
			}
		}
	};
}

export function strictObject<const T extends ObjectEntries>(
	entries: T,
): Schema<InferObjectSchemaType<T>> {
	return objectWithRest(entries, never());
}

export function record<
	const K extends Schema<string | number | symbol>,
	const V extends Schema,
>(key: K, value: V): Schema<Record<Infer<K>, Infer<V>>> {
	return (input) => {
		if (!input || typeof input !== "object") {
			return { expected: "an object", path: [] };
		}
		for (const [k, v] of Object.entries(input)) {
			const issue = key(k) || value(v);
			if (issue) {
				issue.path.push(k);
				return issue;
			}
		}
	};
}

export function picklist<const T extends PicklistOptions>(
	list: T,
): Schema<T[number]> {
	return (input) => {
		if (!list.includes(input as any)) {
			return { expected: `one of ${list.join(", ")}`, path: [] };
		}
	};
}

export function instance<T extends abstract new (...a: any) => any>(
	ctor: T,
): Schema<InstanceType<T>> {
	return (input) => {
		if (!(input instanceof ctor)) {
			return { expected: `an instance of ${ctor.name}`, path: [] };
		}
	};
}

export function set<const Item extends Schema>(
	item: Item,
): Schema<Set<Infer<Item>>> {
	return (input) => {
		if (!(input instanceof Set)) {
			return { expected: "a Set", path: [] };
		}
		for (const v of input) {
			const issue = item(v);
			if (issue) {
				return issue;
			}
		}
	};
}

export function map<const K extends Schema, const V extends Schema>(
	key: K,
	value: V,
): Schema<Map<Infer<K>, Infer<V>>> {
	return (input) => {
		if (!(input instanceof Map)) {
			return { expected: "a Map", path: [] };
		}
		for (const [k, v] of input) {
			const issue = key(k) || value(v);
			if (issue) {
				issue.path.push(k);
				return issue;
			}
		}
	};
}

type TupleItems = MaybeReadonly<Schema[]>;

type InferTuple<T extends TupleItems> = {
	-readonly [K in keyof T]: Infer<T[K]>;
};

export function tuple<const T extends TupleItems>(
	items: T,
): Schema<InferTuple<T>> {
	return (input) => {
		if (!Array.isArray(input)) {
			return { expected: "an array", path: [] };
		}
		for (let i = 0; i < items.length; i++) {
			const issue = items[i](input[i]);
			if (issue) {
				issue.path.push(i);
				return issue;
			}
		}
	};
}

export function tupleWithRest<const T extends TupleItems, R extends Schema>(
	items: T,
	rest: R,
): Schema<[...InferTuple<T>, ...Infer<R>[]]> {
	return (input) => {
		if (!Array.isArray(input)) {
			return { expected: "an array", path: [] };
		}
		const l = Math.max(items.length, input.length);
		for (let i = 0; i < l; i++) {
			const issue = (items[i] || rest)(input[i]);
			if (issue) {
				issue.path.push(i);
				return issue;
			}
		}
	};
}

export function literal<
	const T extends
		| bigint
		| boolean
		| number
		| string
		| symbol
		| null
		| undefined,
>(value: T): Schema<T> {
	return (input) => {
		if (!Object.is(input, value)) {
			return { expected: `the literal value ${String(value)}`, path: [] };
		}
	};
}
