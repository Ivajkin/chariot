var log = require('npmlog'),
    uglifyjs = require('uglify-js'),
    FILE_ENCODING = 'utf-8',
    helper = require('../../helpers');

exports.defaultConfig = {
    moduleId: 'uglifyjs',
    uglifyjs: {
        compressor: {},
        output: {}
    }
};

exports.build = function(context, buildConfig, taskConfig) {
    log.info('uglifyjs', 'Uglifying ' + taskConfig.files.length.toString() + ' files.');

    return helper.asyncForEach(taskConfig.files, function(filePath) {
        return helper.readFile(filePath, FILE_ENCODING).then(function(buf) {
            var ast;
            try {
                console.log("Parsing: " + filePath);
                ast = uglifyjs.parse(buf);
            } catch (e) {
                console.log("Warning occured: " + e);
                var babel = require("@babel/core");

                const isTypeScript = filePath.substr(filePath.length - 3) === '.ts';
                const isTypeScriptTSX = filePath.substr(filePath.length - 4) === '.tsx';

                const esOptions = {
                    plugins: ["@babel/transform-arrow-functions", "@babel/plugin-transform-block-scoping"]
                };
                console.log({ isTypeScript, isTypeScriptTSX, esOptions });
                const tsOnlyOptions = ({ "presets": ["@babel/preset-typescript"] });
                const tsxOptions = ({ "presets": ["@babel/preset-typescript", { allExtensions: true, isTSX: true }] });
                const tsOptions = (isTypeScriptTSX
                    ? tsxOptions
                    : tsOnlyOptions
                );
                const babelOptions =
                    isTypeScript
                        ? tsOptions
                        : esOptions;
                buf = babel.transformSync(buf, babelOptions).code;
                ast = uglifyjs.parse(buf);
            }

            ast.figure_out_scope();

            var compressor = uglifyjs.Compressor(taskConfig.uglifyjs.compressor);
            var compressed_ast = ast.transform(compressor);

            compressed_ast.figure_out_scope();
            compressed_ast.compute_char_frequency();
            compressed_ast.mangle_names();

            if (taskConfig.uglifyjs.output.source_map) {
                var source_map = uglifyjs.SourceMap(taskConfig.uglifyjs.output.source_map);
                taskConfig.uglifyjs.output.source_map = source_map;
            }

            var stream = uglifyjs.OutputStream(taskConfig.uglifyjs.output);
            compressed_ast.print(stream);
            var code = stream.toString();

            return helper.writeFile(filePath, code, FILE_ENCODING).then(function() {
                log.info('uglifyjs', 'Uglified ' + filePath + '.');
            });
        }).fail(function(error) {
            log.error('uglifyjs', error);
            throw new Error(error);
        });
    });
}