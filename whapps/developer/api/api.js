winkstart.module('developer', 'api', {

        subscribe: {
            'api.activate' : 'activate',
            'api.render' : 'render_api',
            'api.request' : 'send_request',
            'api.schema_to_template': 'schema_to_template'
        },

        templates: {
            api: 'tmpl/api.html',
            form: 'tmpl/form.html',
            schema: 'tmpl/schema.html',
            input_id: 'tmpl/input_id.html'
        },

        css: [
            'css/api.css'
        ],

        resources: {
            'api.list': {
                url: '{api_url}/v1/schemas',
                contentType: 'application/json',
                verb: 'GET'
            },
            'api.show': {
                url: '{api_url}/v1/schemas/{id}',
                contentType: 'application/json',
                verb: 'GET'
            }
        }

    },

    function(args) {
        var THIS = this;

        winkstart.registerResources(THIS.__whapp, THIS.config.resources);

        THIS.ressources();
    },
    {
        clean_form: function(obj) {
            var THIS = this,
                isEmpty = function (o) {
                    for(var i in o){ return false;}
                    return true;
                };

            $.each(obj, function(k, o) {
                if(typeof o == "object") {
                    if(isEmpty(o)) {
                        delete obj[k];
                    } else {
                        obj[k] = THIS.clean_form(o);
                        if(isEmpty(obj[k])) {
                            delete obj[k];
                        }
                    }
                } else {
                    if(o == "") {
                        delete obj[k];
                    }
                }
            });

            return obj;
        },

        send_request: function(api, verb, success, failed) {
            var THIS = this,
                request = {
                    account_id: winkstart.apps['developer'].account_id,
                    api_url: winkstart.apps['developer'].api_url,
                },
                data = THIS.clean_form(form2object(api + "_" + verb + "_form"));

            switch(verb) {
                case 'put':
                    request.data = data;
                    break;
                case 'post':
                    request.id = data.id; 
                    delete data.id;
                    request.data = data;
                    break;
                case 'get':
                    request.id = data.id; 
                    break;
                case 'delete':
                    request.id = data.id;
                    break;
            }

            if(typeof success == "function" && typeof failed == "function") {
                winkstart.request('developer.' + api + '.' + verb, 
                    request,
                    success,
                    failed
                );
            }    
        },

        render_api: function(args) {
            var THIS = this,
                form_html = null,
                schema_html = null
                input_id_html = THIS.templates.input_id.tmpl();

            winkstart.request('api.show', {
                    api_url: 'http://192.168.1.42:8000',
                    id: args.id
                },
                function(data, status) {

                    if(THIS.apis[data.data.id]){
                        winkstart.registerResources(THIS.__whapp, THIS.apis[data.data.id].ressources);
                    } else {
                        winkstart.alert('Api not available');
                        return false;
                    }

                    winkstart.publish('api.schema_to_template', data.data.properties, function(required, not_required, schema) {

                        form_html =  THIS.templates.form.tmpl({
                            title: data.data.id,
                            api_url: winkstart.apps['developer'].api_url,
                            account_id: winkstart.apps['developer'].account_id,
                            apis: THIS.apis[data.data.id].api,
                            ressources: THIS.apis[data.data.id].ressources,
                            rest: THIS.rest
                        });

                        schema_html = THIS.templates.schema.tmpl({
                            required: required,
                            not_required: not_required
                        });

                        $('.toggle', form_html).click(function() {
                            var $header = $(this).parent('.whapp-header');
                            (!$header.hasClass('active')) ? $header.addClass('active') : $header.removeClass('active');
                        });

                        $('.try', form_html).click(function(e) {
                            e.preventDefault();
                            var id = $(this).data('id') + '_' +  $(this).data('verb'),
                                print_result = function(_data) {
                                    $('#' + id + ' .result_content', form_html)
                                        .html("<pre>{\n" + THIS.print_r(_data) + "\n}</pre>");
                                    
                                    $('#' + id + ' .result', form_html)
                                        .fadeToggle();
                                };

                            winkstart.publish('api.request', $(this).data('id'), $(this).data('verb'), 
                                function(_data, status) {
                                     print_result(_data);
                                },
                                function(_data, status) {
                                    print_result(_data);
                                }
                            );
                        });


                        $('.details', form_html).click(function(e){
                            e.preventDefault();
                            $('#' + $(this).data('id') + ' .hide', form_html)
                                .slideToggle();
                        });

                        $('.clean', form_html).click(function(e){
                            e.preventDefault();
                            $('#' +  $(this).data('id') + ' .result', form_html)
                                .toggle()
                                .find('.result_content')
                                .empty();
                        });

                        winkstart.accordion(form_html, false);

                    });

                    $('#accounts_get .id', form_html).remove();

                    $('#api-view')
                        .empty()
                        .append(form_html);

                    $('.schema', form_html)
                        .empty()
                        .append(schema_html);

                    $('.id', form_html)
                        .empty()
                        .append(input_id_html);

                    $('*[rel=popover]:not([type="text"])', (form_html)).popover({
                        trigger: 'hover'
                    });

                    $('*[rel=popover][type="text"]', form_html).popover({
                        trigger: 'focus'
                    });
                }
            );
        },

        schema_to_template: function(schema, callback) {
            var tmp = {},
                new_schema = {},
                required = {},
                not_required = {},
                clean = function(data, target) {
                    var new_schema = {};

                    if(typeof data == "object") {
                        $.each(data, function(k, o){
                            switch(o.type) {
                                case 'object':
                                    if(o.properties) {
                                        target[k] = {};
                                        clean(o.properties, target[k]);
                                    } else {
                                        new_schema[k] = o;
                                    }
                                    break;
                                case 'array':
                                    if(o.enum || !o.items || !o.items.properties ){
                                        new_schema[k] = o;
                                    } else {
                                        target[k] = {};
                                        target[k].type = 'array';
                                        clean(o.items.properties, target[k]);
                                    }
                                    break;
                                default:
                                    new_schema[k] = o;
                                    break;
                            }
                        });
                    }

                    $.extend(target, new_schema);
                },
                template = function (data, target, name) {
                    var new_schema = {};

                    $.each(data, function(k, o){
                        if(o.type){
                            (name) ? o.input_name = name + '.' + k : o.input_name = k;
                            new_schema[k] = o
                        } else {
                            (name) ? k = name + '.' + k : k = k;
                            template(o, target, k);
                        }

                    });

                    $.extend(target, new_schema);
                };

            clean(schema, tmp);
            template(tmp, new_schema); 

            $.each(new_schema, function(k, o){
                if(o.required) {
                    required[k] = o;
                } else {
                    not_required[k] = o;
                }
            });

            if(typeof callback == "function"){
                callback(required, not_required, new_schema, schema);
            }
        },

        render_list: function(parent) {
            var THIS = this;

            winkstart.request(true, 'api.list', {
                    api_url: 'http://192.168.1.42:8000'
                },
                function(data, status) {
                    var map_crossbar_data = function(data) {
                        var new_list = [];

                        if(data.length > 0) {
                            $.each(data, function(key, val) {
                                new_list.push({
                                    id: val,
                                    title: val || '(name)'
                                });
                            });
                        }

                        new_list.sort(function(a, b) {
                            return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
                        });

                        return new_list;
                    };

                    $('#api-listpanel', parent)
                        .empty()
                        .listpanel({
                            label: 'Apis',
                            identifier: 'api-listview',
                            new_entity_label: 'APIs',
                            data: map_crossbar_data(data.data),
                            publisher: winkstart.publish,
                            notifyMethod: 'api.render',
                            notifyCreateMethod: '',
                            notifyParent: parent
                    });
                }
            );         
        },

        print_r: function(arr, level) {
            var THIS = this,
                dumped_text = "",
                level_padding = "";

            if(!level) level = 0;
            
            for(var j=0; j< level+1; j++) level_padding += "    ";

            if(typeof(arr) == 'object') { 
                for(var item in arr) {
                    var value = arr[item];
             
                    if(typeof(value) == 'object') { 
                       dumped_text += level_padding + "'" + item + "': { \n";
                       dumped_text += THIS.print_r(value, level+1);
                       dumped_text += level_padding + "}\n";
                    } else {
                       dumped_text += level_padding + "'" + item + "': \"" + value + "\"\n";
                    }
                }
            } else { 
                dumped_text = "===>"+arr+"<===("+typeof(arr)+")";
            }

            return dumped_text;
        },

        activate: function(parent) {
            var THIS = this,
               api_html = THIS.templates.api.tmpl();

            (parent || $('#ws-content'))
                .empty()
                .append(api_html);

            THIS.render_list(api_html);
        },

        ressources: function() {
            var THIS = this;

            THIS.rest = {
                'get_all': {
                    btn: 'primary'
                },
                'get': {
                    btn: 'info',
                    class: ['id']
                },
                'put': {
                    btn: 'success',
                    class: ['schema']
                },
                'post': {
                    btn: '',
                    class: ['id', 'schema']
                },
                'delete': {
                    btn: 'danger',
                    class: ['id']
                }
            };

            THIS.apis = {
                'devices': {
                    api: {
                        'devices': {
                            verbs: ['get_all', 'get', 'put', 'post', 'delete'],
                            title: 'Devices',
                            url: '/devices'
                        },
                        'devices_status': {
                            verbs: ['get_all'],
                            title: 'Devices Status',
                            url: '/devices/status'
                        }
                    },
                    ressources: {
                        'developer.devices.get_all': {
                            url: '{api_url}/accounts/{account_id}/devices',
                            contentType: 'application/json',
                            verb: 'GET'
                        },
                        'developer.devices.get': {
                            url: '{api_url}/accounts/{account_id}/devices/{id}',
                            contentType: 'application/json',
                            verb: 'GET'
                        },
                        'developer.devices.put': {
                            url: '{api_url}/accounts/{account_id}/devices',
                            contentType: 'application/json',
                            verb: 'PUT'
                        },
                        'developer.devices.post': {
                            url: '{api_url}/accounts/{account_id}/devices/{id}',
                            contentType: 'application/json',
                            verb: 'POST'
                        },
                        'developer.devices.delete': {
                            url: '{api_url}/accounts/{account_id}/devices/{id}',
                            contentType: 'application/json',
                            verb: 'DELETE'
                        },
                        'developer.devices_status.get_all': {
                            url: '{api_url}/accounts/{account_id}/devices/status',
                            contentType: 'application/json',
                            verb: 'GET'
                        }
                    }
                },
                'vmboxes': {
                    api: {
                        'vmboxes': {
                            verbs: ['get_all', 'get', 'put', 'post', 'delete'],
                            title: 'VM Boxes',
                            url: '/vmboxes'
                        }
                    },
                    ressources: {
                        'developer.vmboxes.get_all': {
                            url: '{api_url}/accounts/{account_id}/vmboxes',
                            contentType: 'application/json',
                            verb: 'GET'
                        },
                        'developer.vmboxes.get': {
                            url: '{api_url}/accounts/{account_id}/vmboxes/{id}',
                            contentType: 'application/json',
                            verb: 'GET'
                        },
                        'developer.vmboxes.put': {
                            url: '{api_url}/accounts/{account_id}/vmboxes',
                            contentType: 'application/json',
                            verb: 'PUT'
                        },
                        'developer.vmboxes.post': {
                            url: '{api_url}/accounts/{account_id}/vmboxes/{id}',
                            contentType: 'application/json',
                            verb: 'POST'
                        },
                        'developer.vmboxes.delete': {
                            url: '{api_url}/accounts/{account_id}/vmboxes/{id}',
                            contentType: 'application/json',
                            verb: 'DELETE'
                        }
                    }
                },
                'accounts': {
                    api: {
                        'accounts': {
                            verbs: ['get', 'post'],
                            title: 'Accounts',
                            url: '/accounts'
                        },
                        'accounts_children': {
                            verbs: ['get_all'],
                            title: 'Accounts Children',
                            url: '/accounts/{account_id}/children'
                        },
                        'accounts_descendants': {
                            verbs: ['get_all'],
                            title: 'Accounts Descendants',
                            url: '/accounts/{account_id}/descendants'
                        }
                    },
                    ressources: {
                        'developer.accounts.get': {
                            url: '{api_url}/accounts/{account_id}',
                            contentType: 'application/json',
                            verb: 'GET'
                        },
                        'developer.accounts.post': {
                            url: '{api_url}/accounts/{account_id}',
                            contentType: 'application/json',
                            verb: 'POST'
                        },
                        'developer.accounts_children.get_all': {
                            url: '{api_url}/accounts/{account_id}/children',
                            contentType: 'application/json',
                            verb: 'GET'
                        },
                        'developer.accounts_descendants.get_all': {
                            url: '{api_url}/accounts/{account_id}/descendants',
                            contentType: 'application/json',
                            verb: 'GET'
                        }
                    }
                },
                'callflows': {
                    api: {
                        'callflows': {
                            verbs: ['get_all', 'get', 'put', 'post', 'delete'],
                            title: 'Callflows',
                            url: '/callflows'
                        }
                    },
                    ressources: {
                        'developer.callflows.get_all': {
                            url: '{api_url}/accounts/{account_id}/callflows',
                            contentType: 'application/json',
                            verb: 'GET'
                        },
                        'developer.callflows.get': {
                            url: '{api_url}/accounts/{account_id}/callflows/{id}',
                            contentType: 'application/json',
                            verb: 'GET'
                        },
                        'developer.callflows.put': {
                            url: '{api_url}/accounts/{account_id}/callflows',
                            contentType: 'application/json',
                            verb: 'PUT'
                        },
                        'developer.callflows.post': {
                            url: '{api_url}/accounts/{account_id}/callflows/{id}',
                            contentType: 'application/json',
                            verb: 'POST'
                        },
                        'developer.callflows.delete': {
                            url: '{api_url}/accounts/{account_id}/callflows/{id}',
                            contentType: 'application/json',
                            verb: 'DELETE'
                        }
                    }
                }

            };
        }
    }
);




















