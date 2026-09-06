'use client';
import { useEffect, useState, useRef } from 'react';
import { registerReader } from '@/lib/webmcp';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { samples } from '@/lib/extraction.mjs';
import type { Report } from '@/lib/types';
import { compare } from '@/lib/pricing.mjs';
export default function Page() {
  const [texts, setTexts] = useState<string[]>(samples),
    [quantity, setQuantity] = useState('12'),
    [report, setReport] = useState<Report | null>(null),
    [live, setLive] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [assumptions, setAssumptions] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch('/api/compare')
      .then((r) => r.json() as Promise<{ configured: boolean }>)
      .then((d) => setLive(d.configured))
      .catch(() => setError('Could not check model connection'));
  }, []);
  function edit(i: number, value: string) {
    setTexts((old) => old.map((x, n) => (n === i ? value : x)));
    setReport(null);
    setAssumptions({});
  }
  async function analyze(mode: string) {
    setBusy(true);
    setError('');
    setReport(null);
    setAssumptions({});
    try {
      const r = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          quotes: texts,
          quantity: Number(quantity),
          mode,
        }),
      });
      const d = (await r.json()) as Report;
      if (!r.ok) throw Error(d.error);
      setReport(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  let calculation: ReturnType<typeof compare> | null = null,
    calcError = '';
  if (report) {
    try {
      calculation = compare(
        report.quotes.map((q) => ({
          ...q,
          ...Object.fromEntries(
            ['freight', 'tax']
              .filter((k) => assumptions[q.id + '-' + k]?.trim())
              .map((k) => [k, assumptions[q.id + '-' + k].trim()]),
          ),
        })),
        report.quantity,
      );
    } catch (e) {
      calcError = (e as Error).message;
    }
  }
  const current = useRef<unknown>(null);
  useEffect(() => {
    current.current = { report, assumptions, comparison: calculation };
  }, [report, assumptions, calculation]);
  useEffect(() => registerReader(() => current.current), []);
  function download() {
    if (!report) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              ...report,
              userAssumptions: assumptions,
              reviewedComparison: calculation,
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    a.download = 'quoteproof-' + report.id + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <main>
      <header>
        <h1>QuoteProof / Supplier comparison</h1>
        <small>
          {live
            ? 'NVIDIA model on Nebius connected'
            : 'Live model setup pending · practice available'}
        </small>
      </header>
      <p>
        Compare quoted terms, not just the headline price. Paste one term per
        line using labels such as “Unit price: INR 110.00” and “Minimum
        quantity: 1”.
      </p>
      <div className="inputs">
        {texts.map((v, i) => (
          <section className="quote-input" key={i}>
            <label htmlFor={'quote-' + i}>Quote {i + 1}</label>
            <Textarea
              disabled={busy}
              id={'quote-' + i}
              value={v}
              maxLength={7000}
              onChange={(e) => edit(i, e.target.value)}
            />
          </section>
        ))}
      </div>
      <div className="controls">
        <label htmlFor="quantity">Required units</label>
        <Input
          disabled={busy}
          id="quantity"
          type="number"
          min={1}
          max={1000000}
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value);
            setReport(null);
          }}
        />
        <Button disabled={busy || !live} onClick={() => analyze('nebius')}>
          Extract with NVIDIA
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => analyze('fixture')}
        >
          Practice on sample
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setTexts([...samples]);
            setQuantity('12');
            setReport(null);
            setAssumptions({});
          }}
        >
          Reset sample
        </Button>
      </div>
      {busy && <output>Extracting terms and checking source evidence…</output>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {report && (
        <section className="results">
          <h2>Evidence before a decision</h2>
          <small>
            {report.mode === 'fixture'
              ? 'Synthetic practice extraction — no AI call'
              : 'Live ' + report.model}{' '}
            · {report.quantity} units requested
          </small>
          {calcError ? (
            <p className="error" role="alert">
              Check the assumption values: {calcError}
            </p>
          ) : (
            <>
              {calculation!.lowestLandedQuoteIds ? (
                <p className="good">
                  Lowest complete quoted total among comparable offers:{' '}
                  {calculation!.lowestLandedQuoteIds.join(', ')}. Review all
                  assumptions before deciding.
                </p>
              ) : (
                <p className="flag">
                  No landed-cost winner: costs are missing or fewer than two
                  offers meet the requested quantity.
                </p>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      'Quote',
                      'Unit price (INR)',
                      'Units supplied',
                      'Goods (INR)',
                      'Total incl. freight/tax',
                      'Conditions',
                    ].map((x) => (
                      <TableHead key={x}>{x}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculation!.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.id}</TableCell>
                      <TableCell>
                        {r.unitPrice ??
                          r.unitPriceExact.minorUnitsNumerator +
                            '/' +
                            r.unitPriceExact.denominator +
                            ' paise'}
                      </TableCell>
                      <TableCell>{r.suppliedQuantity}</TableCell>
                      <TableCell>{r.goodsTotal}</TableCell>
                      <TableCell>{r.landedTotal ?? 'Unknown'}</TableCell>
                      <TableCell>
                        {r.constraints.join(', ').replaceAll('_', ' ') ||
                          'Quantity comparable'}
                        {r.missingTerms.length > 0 && (
                          <p>Missing: {r.missingTerms.join(', ')}</p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
          <div className="evidence">
            {report.quotes.map((q) => (
              <section key={q.id}>
                <h3>{q.id} / Source & assumptions</h3>
                <details>
                  <summary>Inspect quoted evidence</summary>
                  {Object.entries(q.evidence).map(([field, e]) => (
                    <blockquote key={field}>
                      <strong>{field}</strong>
                      <p>{e.quote}</p>
                      <small>{e.sourceId}</small>
                    </blockquote>
                  ))}
                </details>
                <p>
                  <small>
                    Optional overrides are your assumptions, not supplier
                    evidence. Clear an override to restore the source value.
                  </small>
                </p>
                {(['freight', 'tax'] as const).map((k) => (
                  <div key={k}>
                    <label htmlFor={q.id + k}>
                      {k === 'freight' ? 'Freight' : 'Tax'} assumption (INR)
                    </label>
                    <Input
                      id={q.id + k}
                      placeholder={q[k] ?? 'Unknown'}
                      value={assumptions[q.id + '-' + k] ?? ''}
                      onChange={(e) =>
                        setAssumptions((old) => ({
                          ...old,
                          [q.id + '-' + k]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </section>
            ))}
          </div>
          <div className="controls" style={{ marginTop: 24 }}>
            <Button disabled={!!calcError} onClick={download}>
              Export evidence report
            </Button>
          </div>
        </section>
      )}
      <footer>
        No supplier contact, purchasing or payments. One currency: INR. Exact
        calculations do not prove source truth. Live extraction sends the pasted
        quotes to Nebius; reports remain in this page until exported.
      </footer>
    </main>
  );
}
