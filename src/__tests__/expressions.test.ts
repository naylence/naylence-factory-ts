import { Expressions, env, config, literal } from '../expressions';

describe('Expressions', () => {
    describe('env expressions', () => {
        it('should create environment variable expressions without defaults', () => {
            expect(Expressions.env('TEST_VAR')).toBe('${env:TEST_VAR}');
            expect(Expressions.env('NODE_ENV')).toBe('${env:NODE_ENV}');
        });

        it('should create environment variable expressions with defaults', () => {
            expect(Expressions.env('PORT', '8080')).toBe('${env:PORT:8080}');
            expect(Expressions.env('HOST', 'localhost')).toBe(
                '${env:HOST:localhost}'
            );
            expect(Expressions.env('DEBUG', '')).toBe('${env:DEBUG:}'); // empty default
        });

        it('should work with function syntax', () => {
            expect(env('TEST_VAR')).toBe('${env:TEST_VAR}');
            expect(env('PORT', '3000')).toBe('${env:PORT:3000}');
        });
    });

    describe('config expressions', () => {
        it('should create config expressions without defaults', () => {
            expect(Expressions.config('database.host')).toBe(
                '${config:database.host}'
            );
            expect(Expressions.config('api.version')).toBe(
                '${config:api.version}'
            );
        });

        it('should create config expressions with defaults', () => {
            expect(Expressions.config('database.port', '5432')).toBe(
                '${config:database.port:5432}'
            );
            expect(Expressions.config('timeout', '30')).toBe(
                '${config:timeout:30}'
            );
            expect(Expressions.config('flag', '')).toBe('${config:flag:}'); // empty default
        });

        it('should work with function syntax', () => {
            expect(config('test.key')).toBe('${config:test.key}');
            expect(config('test.key', 'default')).toBe(
                '${config:test.key:default}'
            );
        });
    });

    describe('literal values', () => {
        it('should return literal strings unchanged', () => {
            expect(Expressions.literal('https://api.example.com')).toBe(
                'https://api.example.com'
            );
            expect(Expressions.literal('plain text')).toBe('plain text');
            expect(Expressions.literal('')).toBe('');
        });

        it('should work with function syntax', () => {
            expect(literal('test value')).toBe('test value');
        });
    });

    describe('aliases', () => {
        it('should provide environment alias for env', () => {
            expect(Expressions.environment('TEST')).toBe('${env:TEST}');
            expect(Expressions.environment('TEST', 'default')).toBe(
                '${env:TEST:default}'
            );
        });

        it('should provide setting alias for config', () => {
            expect(Expressions.setting('key')).toBe('${config:key}');
            expect(Expressions.setting('key', 'default')).toBe(
                '${config:key:default}'
            );
        });
    });

    describe('usage examples', () => {
        it('should create realistic configuration examples', () => {
            const config = {
                database: {
                    host: Expressions.env('DB_HOST', 'localhost'),
                    port: Expressions.env('DB_PORT', '5432'),
                    name: Expressions.config('database.name', 'app_db'),
                },
                api: {
                    baseUrl: Expressions.literal('https://api.example.com'),
                    timeout: Expressions.env('API_TIMEOUT', '30000'),
                },
                debug: Expressions.env('DEBUG', 'false'),
            };

            expect(config.database.host).toBe('${env:DB_HOST:localhost}');
            expect(config.database.port).toBe('${env:DB_PORT:5432}');
            expect(config.database.name).toBe('${config:database.name:app_db}');
            expect(config.api.baseUrl).toBe('https://api.example.com');
            expect(config.api.timeout).toBe('${env:API_TIMEOUT:30000}');
            expect(config.debug).toBe('${env:DEBUG:false}');
        });
    });
});
