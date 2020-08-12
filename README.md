# CSS To Tailwind

Work in progress.

Package to convert CSS to [TailwindCSS](https://github.com/tailwindlabs/tailwindcss) classes.

## Usage

`npx css-to-tailwind ".logo { margin-bottom: 1.6rem; min-height: 4rem; display: flex; justify-content: center; }"`

The package also offers a Node API, including custom Tailwind config option.

## Output

`Array<{ selector: string, tailwind: string, missing: Array<Tuple>}>`

- `selector`: The selector used in the input CSS.
- `tailwind`: List of TailwindCSS classes in a single string, separated by a space.
- `missing`: Array of tuples to inform about the CSS that cannot be covered by Tailwind classes.

```
[
  {
    "selector": ".logo",
    "tailwind": "flex justify-center mb-6",
    "missing": [
      [
        "min-height",
        "4rem"
      ]
    ]
  }
]
```

## License

MIT