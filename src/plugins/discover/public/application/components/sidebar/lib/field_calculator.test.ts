/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Any modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import _ from 'lodash';
// @ts-ignore
import realHits from 'fixtures/real_hits.js';
// @ts-ignore
import stubbedLogstashFields from 'fixtures/logstash_fields';
import { coreMock } from '../../../../../../../core/public/mocks';
import { IndexPattern } from '../../../../../../data/public';
import { getStubIndexPattern } from '../../../../../../data/public/test_utils';
// @ts-ignore
import { fieldCalculator } from './field_calculator';

let indexPattern: IndexPattern;

describe('fieldCalculator', function () {
  beforeEach(function () {
    indexPattern = getStubIndexPattern(
      'logstash-*',
      (cfg: any) => cfg,
      'time',
      stubbedLogstashFields(),
      coreMock.createSetup()
    );
  });
  it('should have a _countMissing that counts nulls & undefineds in an array', function () {
    const values = [
      ['foo', 'bar'],
      'foo',
      'foo',
      undefined,
      ['foo', 'bar'],
      'bar',
      'baz',
      null,
      null,
      null,
      'foo',
      undefined,
    ];
    expect(fieldCalculator._countMissing(values)).toBe(5);
  });

  describe('_groupValues', function () {
    let groups: Record<string, any>;
    let params: any;
    let values: any;
    beforeEach(function () {
      values = [
        ['foo', 'bar'],
        'foo',
        'foo',
        undefined,
        ['foo', 'bar'],
        'bar',
        'baz',
        null,
        null,
        null,
        'foo',
        undefined,
      ];
      params = {};
      groups = fieldCalculator._groupValues(values, params);
    });

    it('should have a _groupValues that counts values', function () {
      expect(groups).toBeInstanceOf(Object);
    });

    it('should throw an error if any value is a plain object', function () {
      expect(function () {
        fieldCalculator._groupValues([{}, true, false], params);
      }).toThrowError();
    });

    it('should handle values with dots in them', function () {
      values = ['0', '0.........', '0.......,.....'];
      params = {};
      groups = fieldCalculator._groupValues(values, params);
      expect(groups[values[0]].count).toBe(1);
      expect(groups[values[1]].count).toBe(1);
      expect(groups[values[2]].count).toBe(1);
    });

    it('should have a a key for value in the array when not grouping array terms', function () {
      expect(_.keys(groups).length).toBe(3);
      expect(groups.foo).toBeInstanceOf(Object);
      expect(groups.bar).toBeInstanceOf(Object);
      expect(groups.baz).toBeInstanceOf(Object);
    });

    it('should count array terms independently', function () {
      expect(groups['foo,bar']).toBe(undefined);
      expect(groups.foo.count).toBe(5);
      expect(groups.bar.count).toBe(3);
      expect(groups.baz.count).toBe(1);
    });

    describe('grouped array terms', function () {
      beforeEach(function () {
        params.grouped = true;
        groups = fieldCalculator._groupValues(values, params);
      });

      it('should group array terms when passed params.grouped', function () {
        expect(_.keys(groups).length).toBe(4);
        expect(groups['foo,bar']).toBeInstanceOf(Object);
      });

      it('should contain the original array as the value', function () {
        expect(groups['foo,bar'].value).toEqual(['foo', 'bar']);
      });

      it('should count the pairs separately from the values they contain', function () {
        expect(groups['foo,bar'].count).toBe(2);
        expect(groups.foo.count).toBe(3);
        expect(groups.bar.count).toBe(1);
      });
    });
  });

  describe('getFieldValues', function () {
    let hits: any;

    beforeEach(function () {
      hits = _.each(_.cloneDeep(realHits), (hit) => indexPattern.flattenHit(hit));
    });

    it('Should return an array of values for _source fields', function () {
      const extensions = fieldCalculator.getFieldValues(
        hits,
        indexPattern.fields.getByName('extension'),
        indexPattern
      );
      expect(extensions).toBeInstanceOf(Array);
      expect(
        _.filter(extensions, function (v) {
          return v === 'html';
        }).length
      ).toBe(8);
      expect(_.uniq(_.clone(extensions)).sort()).toEqual(['gif', 'html', 'php', 'png']);
    });

    it('Should return an array of values for core meta fields', function () {
      const types = fieldCalculator.getFieldValues(
        hits,
        indexPattern.fields.getByName('_type'),
        indexPattern
      );
      expect(types).toBeInstanceOf(Array);
      expect(
        _.filter(types, function (v) {
          return v === 'apache';
        }).length
      ).toBe(18);
      expect(_.uniq(_.clone(types)).sort()).toEqual(['apache', 'nginx']);
    });
  });

  describe('getFieldValueCounts', function () {
    let params: { hits: any; field: any; count: number; indexPattern: IndexPattern };
    beforeEach(function () {
      params = {
        hits: _.cloneDeep(realHits),
        field: indexPattern.fields.getByName('extension'),
        count: 3,
        indexPattern,
      };
    });

    it('counts the top 3 values', function () {
      const extensions = fieldCalculator.getFieldValueCounts(params);
      expect(extensions).toBeInstanceOf(Object);
      expect(extensions.buckets).toBeInstanceOf(Array);
      expect(extensions.buckets.length).toBe(3);
      expect(_.map(extensions.buckets, 'value')).toEqual(['html', 'php', 'gif']);
      expect(extensions.error).toBe(undefined);
    });

    it('fails to analyze geo and attachment types', function () {
      params.field = indexPattern.fields.getByName('point');
      expect(fieldCalculator.getFieldValueCounts(params).error).not.toBe(undefined);

      params.field = indexPattern.fields.getByName('area');
      expect(fieldCalculator.getFieldValueCounts(params).error).not.toBe(undefined);

      params.field = indexPattern.fields.getByName('request_body');
      expect(fieldCalculator.getFieldValueCounts(params).error).not.toBe(undefined);
    });

    it('fails to analyze fields that are in the mapping, but not the hits', function () {
      params.field = indexPattern.fields.getByName('ip');
      expect(fieldCalculator.getFieldValueCounts(params).error).not.toBe(undefined);
    });

    it('counts the total hits', function () {
      expect(fieldCalculator.getFieldValueCounts(params).total).toBe(params.hits.length);
    });

    it('counts the hits the field exists in', function () {
      params.field = indexPattern.fields.getByName('phpmemory');
      expect(fieldCalculator.getFieldValueCounts(params).exists).toBe(5);
    });
  });
});
