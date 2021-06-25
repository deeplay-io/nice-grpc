import {Metadata} from './Metadata';

test('init', () => {
  expect(new Map(Metadata())).toMatchInlineSnapshot(`Map {}`);

  expect(
    new Map(
      Metadata(
        Metadata().set('key-1', 'value-1').set('Key-2', ['value-2', 'value-3']),
      ),
    ),
  ).toMatchInlineSnapshot(`
    Map {
      "key-1" => Array [
        "value-1",
      ],
      "key-2" => Array [
        "value-2, value-3",
      ],
    }
  `);

  expect(
    new Map(
      Metadata(
        new Map().set('key-1', 'value-1').set('Key-2', ['value-2', 'value-3']),
      ),
    ),
  ).toMatchInlineSnapshot(`
    Map {
      "key-1" => Array [
        "value-1",
      ],
      "key-2" => Array [
        "value-2, value-3",
      ],
    }
  `);

  expect(
    new Map(
      Metadata({
        'key-1': 'value-1',
        'Key-2': ['value-2', 'value-3'],
      }),
    ),
  ).toMatchInlineSnapshot(`
    Map {
      "key-1" => Array [
        "value-1",
      ],
      "key-2" => Array [
        "value-2, value-3",
      ],
    }
  `);

  expect(
    new Map(
      Metadata(
        Metadata()
          .set('key-1-bin', new Uint8Array([1]))
          .set('Key-2-Bin', [new Uint8Array([2]), new Uint8Array([3])]),
      ),
    ),
  ).toMatchInlineSnapshot(`
    Map {
      "key-1-bin" => Array [
        Uint8Array [
          1,
        ],
      ],
      "key-2-bin" => Array [
        Uint8Array [
          2,
        ],
        Uint8Array [
          3,
        ],
      ],
    }
  `);

  expect(
    new Map(
      Metadata(
        new Map()
          .set('key-1-bin', new Uint8Array([1]))
          .set('Key-2-Bin', [new Uint8Array([2]), new Uint8Array([3])]),
      ),
    ),
  ).toMatchInlineSnapshot(`
    Map {
      "key-1-bin" => Array [
        Uint8Array [
          1,
        ],
      ],
      "key-2-bin" => Array [
        Uint8Array [
          2,
        ],
        Uint8Array [
          3,
        ],
      ],
    }
  `);

  expect(
    new Map(
      Metadata({
        'key-1-bin': new Uint8Array([1]),
        'Key-2-bin': [new Uint8Array([2]), new Uint8Array([3])],
      }),
    ),
  ).toMatchInlineSnapshot(`
    Map {
      "key-1-bin" => Array [
        Uint8Array [
          1,
        ],
      ],
      "key-2-bin" => Array [
        Uint8Array [
          2,
        ],
        Uint8Array [
          3,
        ],
      ],
    }
  `);

  expect(() => {
    Metadata(new Map().set('key-1-bin', 'value-1'));
  }).toThrowErrorMatchingInlineSnapshot(
    `"Metadata key 'key-1-bin' ends with '-bin', thus it must have binary value"`,
  );

  expect(() => {
    Metadata({'key-1-bin': 'value-1'});
  }).toThrowErrorMatchingInlineSnapshot(
    `"Metadata key 'key-1-bin' ends with '-bin', thus it must have binary value"`,
  );

  expect(() => {
    Metadata(new Map().set('key-1', new Uint8Array()));
  }).toThrowErrorMatchingInlineSnapshot(
    `"Metadata key 'key-1' doesn't end with '-bin', thus it must have string value"`,
  );

  expect(() => {
    Metadata({'key-1': new Uint8Array()});
  }).toThrowErrorMatchingInlineSnapshot(
    `"Metadata key 'key-1' doesn't end with '-bin', thus it must have string value"`,
  );
});

test('init via new', () => {
  expect(new Map(new Metadata())).toMatchInlineSnapshot(`Map {}`);

  expect(new Map(new Metadata({key: 'value'}))).toMatchInlineSnapshot(`
    Map {
      "key" => Array [
        "value",
      ],
    }
  `);
});

test('set', () => {
  const metadata = Metadata();

  expect(new Map(metadata)).toMatchInlineSnapshot(`Map {}`);

  metadata.set('key', 'value-1');

  expect(new Map(metadata)).toMatchInlineSnapshot(`
    Map {
      "key" => Array [
        "value-1",
      ],
    }
  `);

  metadata.set('Key', 'value-2');

  expect(new Map(metadata)).toMatchInlineSnapshot(`
    Map {
      "key" => Array [
        "value-2",
      ],
    }
  `);

  metadata.set('key', ['value-1', 'value-2']);

  expect(new Map(metadata)).toMatchInlineSnapshot(`
    Map {
      "key" => Array [
        "value-1, value-2",
      ],
    }
  `);

  metadata.set('key-bin', new Uint8Array([1]));

  expect(new Map(metadata)).toMatchInlineSnapshot(`
    Map {
      "key" => Array [
        "value-1, value-2",
      ],
      "key-bin" => Array [
        Uint8Array [
          1,
        ],
      ],
    }
  `);
});

test('append', () => {
  const metadata = Metadata();

  metadata.append('key', 'value-1');

  expect(new Map(metadata)).toMatchInlineSnapshot(`
    Map {
      "key" => Array [
        "value-1",
      ],
    }
  `);

  metadata.append('Key', 'value-2');

  expect(new Map(metadata)).toMatchInlineSnapshot(`
    Map {
      "key" => Array [
        "value-1, value-2",
      ],
    }
  `);

  metadata.append('key-bin', new Uint8Array([1]));

  expect(new Map(metadata)).toMatchInlineSnapshot(`
    Map {
      "key" => Array [
        "value-1, value-2",
      ],
      "key-bin" => Array [
        Uint8Array [
          1,
        ],
      ],
    }
  `);

  metadata.append('Key-Bin', new Uint8Array([2]));

  expect(new Map(metadata)).toMatchInlineSnapshot(`
    Map {
      "key" => Array [
        "value-1, value-2",
      ],
      "key-bin" => Array [
        Uint8Array [
          1,
        ],
        Uint8Array [
          2,
        ],
      ],
    }
  `);
});

test('delete', () => {
  const metadata = Metadata();

  metadata.set('key', 'value');
  metadata.delete('Key');
  metadata.delete('non-existent-key');

  expect(new Map(metadata)).toMatchInlineSnapshot(`Map {}`);
});

test('get', () => {
  const metadata = Metadata({
    key: ['value-1', 'value-2'],
    'key-bin': [new Uint8Array([1]), new Uint8Array([2])],
  });

  expect(metadata.get('key')).toMatchInlineSnapshot(`"value-1, value-2"`);
  expect(metadata.get('Key')).toMatchInlineSnapshot(`"value-1, value-2"`);
  expect(metadata.get('key-bin')).toMatchInlineSnapshot(`
    Uint8Array [
      1,
    ]
  `);
  expect(metadata.get('Key-Bin')).toMatchInlineSnapshot(`
    Uint8Array [
      1,
    ]
  `);
  expect(metadata.get('non-existent-key')).toMatchInlineSnapshot(`undefined`);
});

test('getAll', () => {
  const metadata = Metadata({
    key: ['value-1', 'value-2'],
    'key-bin': [new Uint8Array([1]), new Uint8Array([2])],
  });

  expect(metadata.getAll('key')).toMatchInlineSnapshot(`
    Array [
      "value-1, value-2",
    ]
  `);
  expect(metadata.getAll('Key')).toMatchInlineSnapshot(`
    Array [
      "value-1, value-2",
    ]
  `);
  expect(metadata.getAll('key-bin')).toMatchInlineSnapshot(`
    Array [
      Uint8Array [
        1,
      ],
      Uint8Array [
        2,
      ],
    ]
  `);
  expect(metadata.getAll('Key-Bin')).toMatchInlineSnapshot(`
    Array [
      Uint8Array [
        1,
      ],
      Uint8Array [
        2,
      ],
    ]
  `);
  expect(metadata.getAll('non-existent-key')).toMatchInlineSnapshot(`Array []`);
});

test('has', () => {
  const metadata = Metadata({
    key: ['value-1', 'value-2'],
    'key-bin': [new Uint8Array([1]), new Uint8Array([2])],
  });

  expect(metadata.has('key')).toMatchInlineSnapshot(`true`);
  expect(metadata.has('Key')).toMatchInlineSnapshot(`true`);
  expect(metadata.has('key-bin')).toMatchInlineSnapshot(`true`);
  expect(metadata.has('Key-Bin')).toMatchInlineSnapshot(`true`);
  expect(metadata.has('non-existent-key')).toMatchInlineSnapshot(`false`);
});

test('invalid key', () => {
  const metadata = Metadata();

  expect(() => metadata.set('лол', 'value')).toThrowErrorMatchingInlineSnapshot(
    `"Metadata key 'лол' contains illegal characters"`,
  );
});

test('invalid value', () => {
  const metadata = Metadata();

  expect(() => metadata.set('key', 'лол')).toThrowErrorMatchingInlineSnapshot(
    `"Metadata value 'лол' of key 'key' contains illegal characters"`,
  );
});
