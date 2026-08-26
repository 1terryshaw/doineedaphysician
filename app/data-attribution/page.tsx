import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Attribution & Licences",
  description:
    "Open-data sources used by DoINeedAPhysician.com, and the licence text they are made available under.",
};

// CDLA-Permissive-2.0 — verbatim. Required by §2.1: a Data Recipient may share Data
// "so long as the Data Recipient makes available the text of this agreement with the
// shared Data". Do not paraphrase, summarise, or truncate this string.
const CDLA_PERMISSIVE_2_0 = `Community Data License Agreement - Permissive - Version 2.0

This is the Community Data License Agreement - Permissive, Version 2.0 (the "agreement"). Data Provider(s) and Data Recipient(s) agree as follows:

1. Provision of the Data

1.1. A Data Recipient may use, modify, and share the Data made available by Data Provider(s) under this agreement if that Data Recipient follows the terms of this agreement.

1.2. This agreement does not impose any restriction on a Data Recipient's use, modification, or sharing of any portions of the Data that are in the public domain or that may be used, modified, or shared under any other legal exception or limitation.

2. Conditions for Sharing Data

2.1. A Data Recipient may share Data, with or without modifications, so long as the Data Recipient makes available the text of this agreement with the shared Data.

3. No Restrictions on Results

3.1. This agreement does not impose any restriction or obligations with respect to the use, modification, or sharing of Results.

4. No Warranty; Limitation of Liability

4.1. All Data Recipients receive the Data subject to the following terms:

THE DATA IS PROVIDED ON AN "AS IS" BASIS, WITHOUT REPRESENTATIONS, WARRANTIES OR CONDITIONS OF ANY KIND, EITHER EXPRESS OR IMPLIED INCLUDING, WITHOUT LIMITATION, ANY WARRANTIES OR CONDITIONS OF TITLE, NON-INFRINGEMENT, MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.

NO DATA PROVIDER SHALL HAVE ANY LIABILITY FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING WITHOUT LIMITATION LOST PROFITS), HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE DATA OR RESULTS, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

5. Definitions

5.1. "Data" means the material received by a Data Recipient under this agreement.

5.2. "Data Provider" means any person who is the source of Data provided under this agreement and in reliance on a Data Recipient's agreement to its terms.

5.3. "Data Recipient" means any person who receives Data directly or indirectly from a Data Provider and agrees to the terms of this agreement.

5.4. "Results" means any outcome obtained by computational analysis of Data, including for example machine learning models and models' insights.`;

const FOURSQUARE_NOTICE = `Copyright 2024 Foursquare Labs, Inc.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this
file except in compliance with the License. You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the specific language governing
permissions and limitations under the License.`;

function LicenseBlock({ text }: { text: string }) {
  return (
    <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded border border-gray-200 bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-800">
      {text}
    </pre>
  );
}

export default function DataAttributionPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-8">Data Attribution &amp; Licences</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: August 13, 2026</p>

      <div className="prose prose-gray max-w-none space-y-8 text-sm text-gray-700 leading-relaxed">
        <section>
          <p>
            Some information shown on this site &mdash; for example a business website
            address &mdash; is drawn from open data published by the Overture Maps
            Foundation. This page makes the licence terms of that data available, as
            those licences require, and records the attribution notices that come with
            it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Overture Maps Foundation</h2>
          <p>
            Source: the Overture Maps Foundation <em>places</em> theme, obtained from the
            official public distribution.
          </p>
          <p className="mt-2">
            Citation:{" "}
            <strong>
              Overture Maps Foundation,{" "}
              <a
                href="https://overturemaps.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                overturemaps.org
              </a>
            </strong>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Community Data License Agreement &ndash; Permissive, Version 2.0
          </h2>
          <p>
            The Overture <em>places</em> data used on this site is made available under
            the CDLA-Permissive-2.0. The full text of that agreement follows.
          </p>
          <LicenseBlock text={CDLA_PERMISSIVE_2_0} />
          <p className="mt-2 text-xs text-gray-500">
            Canonical text:{" "}
            <a
              href="https://cdla.dev/permissive-2-0/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              cdla.dev/permissive-2-0
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Foursquare &mdash; Apache License 2.0
          </h2>
          <p>
            A small subset of Overture places records (approximately 3%) lists Foursquare
            among its contributing sources. That subset is licensed under the Apache
            License, Version 2.0, and carries the following notice.
          </p>
          <LicenseBlock text={FOURSQUARE_NOTICE} />
          <p className="mt-2 text-xs text-gray-500">
            Full licence text:{" "}
            <a
              href="https://www.apache.org/licenses/LICENSE-2.0"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              apache.org/licenses/LICENSE-2.0
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            AllThePlaces &mdash; CC0 1.0
          </h2>
          <p>
            A further subset of Overture places records originates from AllThePlaces,
            which is dedicated to the public domain under{" "}
            <a
              href="https://creativecommons.org/publicdomain/zero/1.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              CC0 1.0
            </a>
            . No conditions attach to its use or redistribution.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Corrections</h2>
          <p>
            If you believe data attributed here is inaccurate or should not appear, contact
            us at{" "}
            <a href="mailto:hello@doineedaphysician.com" className="underline">
              hello@doineedaphysician.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
