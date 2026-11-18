import { jsonLd } from '../seo/schemas/json-ld';

describe('jsonLd', () => {
  it('cannot be used to close the script tag', () => {
    const out = jsonLd({ title: 'Accountant</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<');
  });

  it('still parses back to the same data', () => {
    const data = { title: 'R&D <lead>   next', n: 3 };
    expect(JSON.parse(jsonLd(data))).toEqual(data);
  });
});
