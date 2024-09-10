class Tag {
    constructor(){
        this.html = '';
        this.html_line_positin = 0;

        this.type = '';
        this.symbol = '';

        this.beginning_tag_index = 0;
        this.ending_tag_index = 0;

        this.element = '';
        this.element_text = '';

        this.header = {list: []};

        alert('Изменения внесены')
    }

    get_properties(tag_object){
        let object = tag_object;
        let new_object = this;

        function recursion(object, new_object){
            object = Object.entries(object);

            object.forEach(([key, propertie])=>{
                new_object[key] = Object.prototype.toString.call(propertie) === '[object Object]' ?
                                recursion(propertie, new_object[key]) : propertie;
            })
            return new_object;
        }
        recursion(object, new_object);
        return new_object;
    }
}

class HTMLCustomTagsError extends Error{
    constructor(...props){
        super(...props)

        this.name = 'HTMLCustomTagsError'
    }
}

class CustomTag extends Tag{
    constructor(...props){
        super(...props)
        
        this.tags_list = {};
        this.processed_function_tags = [];
        this.invalid_functions_tags = [];

        this.new_html = this.html;
    }

    /**
     * @param {string} tag_type
     * @param {string|null} source_html
     * @returns {list}
     * @ This method accepts the type of the tag being searched for (variable or function) and 
     * searches for tags of the form [[ some_variable ]] and [% some_function %] in the HTML code of the page.
     * @ Also, when searching for internal tags, it takes as a parameter the internal HTML code of the function tag, 
     * in which it performs the search, outside the main HTML code of the page.
     * @ Returns an array containing the found tags as objects.
     */
    get_html_tags_list(tag_type, parent_tag=null, cleaning=null) {
        let self = this;
        let source_html;
        let last_tag_index = 0;
        let opening_tag_symbol;
        let closing_tag_symbol;
        let index_number = 0;
        let __tags_list__ = [];
        
        if (tag_type == 'variable' || tag_type == 'inner_variable'){
            opening_tag_symbol = '[[';   closing_tag_symbol = ']]';
        } else if (tag_type == 'function'){
            opening_tag_symbol = '[%';   closing_tag_symbol = '%]';
        }

        source_html = parent_tag == null ? this.new_html : parent_tag.internal_html.original;

        function recursion() {
            let tag = new Tag();
            
            tag.html = self.html;
            tag.type = tag_type;
            tag.symbol = opening_tag_symbol;
            tag.index_number = index_number;

            tag.beginning_tag_index = source_html.indexOf(opening_tag_symbol, last_tag_index+1);
            tag.ending_tag_index = source_html.indexOf(closing_tag_symbol, last_tag_index+1);
            // tag.html_line_positin = self.get_tag_position_in_html(tag);
            
            last_tag_index = tag.ending_tag_index;
                
            if (tag.beginning_tag_index != -1 && tag.ending_tag_index != -1){
                tag.element = source_html.slice(tag.beginning_tag_index, tag.ending_tag_index+2);
                tag.element_text = source_html.slice(tag.beginning_tag_index+2, tag.ending_tag_index);

                tag.element_text = tag.element_text.replace(/^\s*/, '').replace(/\s*$/, '');
                
                if (tag.type == 'variable' || tag.type == 'inner_variable'){
                    tag.header.list = tag.element_text.split('.');
                } else if (tag.type == 'function') {
                    tag.header.list = tag.element_text.split(' ');
                }
                
                tag.ending_tag_index = tag.ending_tag_index + 2;
                
                if (!self.variable_is_global(tag) && tag.type == 'variable'){
                    __tags_list__.push(tag);
                    return recursion();
                } else if (parent_tag != null) {
                    
                    if (tag.header.list[0] != parent_tag.header.dict.variable){
                        return recursion();
                    }
                }

                tag = self.tag_identification(tag);

                index_number++;

                __tags_list__.push(tag);

                return recursion();
            }
        }
        recursion();
        return __tags_list__;
    }

    // get_tag_position_in_html(tag){
    //     let html_search_string = this.html.slice(0, tag.beginning_tag_index);      
    //     let line_break_count = html_search_string.match(new RegExp(`\\n`, 'g')).length;
    //     console.log(tag, line_break_count);
    //     return line_break_count;
    // }

    tag_identification(tag){
        if (tag.type == 'variable' || tag.type == 'inner_variable'){
            return new VariableTag().get_properties(tag);
        } else if (tag.type == 'function' && tag.header.list.length > 1){
            return new FunctionOpenTag().get_properties(tag);
        } else if (tag.type == 'function' && FunctionEndTag.check_for_endtag(tag)){
            return new FunctionEndTag().get_properties(tag);
        } else if (tag.type == 'function' && FunctionElseTag.check_else_tag(tag)){
            return new FunctionElseTag().get_properties(tag);
        }
        throw new HTMLCustomTagsError(`Failed to set tag type or syntax is invalid: ${tag.element}`);
    }

    variable_is_global(tag){
        let condition = tag.header.list[0] in window ? true : false
        return condition;
    }
    
    /**
     * @param {string} variable
     * @returns {list} 
     */
    variable_to_list(variable){
        if (typeof(variable) == 'string'){
            if(variable.indexOf('.') != -1){
                return variable.split('.');
            } else {
                return [variable];
            }
        } else {
            throw new HTMLCustomTagsError(`The "variable" parameter must be a string, not an ${typeof(variable)}. Variable ${variable}`);
        }
    }

    /**
     * @param {object} tag
     * @returns {string} tag_content
     * @ This method takes as a parameter a string that is a representation of an object in code, for example:
     * @ some_variable.some_propertie
     * @ Collects information from an object that was received from the server API and is located in the global area 
     * @ of ​​the JS code in the form of a variable identical to the text representation of the object.
     * @ Returns information as a string, or as an array if the iterable object contains the desired property
     */
    get_tag_content(variable_header_list, search_scope=null){
        let tag_content;
        
        if (search_scope == null){
            search_scope = window;
        } else if (search_scope == ''){
            return '';
        }

        if (variable_header_list.length > 0 && variable_header_list[0] in search_scope){           
            
            variable_header_list.forEach((propertie, ind)=>{
                tag_content = ind == 0 ? search_scope[propertie] : tag_content[propertie];
            });
            
            if (tag_content === undefined){
                tag_content = '';
            }

            return tag_content;
        } else {
            let search_scope_string = '';
            if (search_scope == window){
                search_scope_string = window
            } else {
                search_scope = Object.entries(search_scope);
                search_scope.forEach(([key, value])=>{search_scope_string += `${key}: ${value}, `});
            }
            throw new HTMLCustomTagsError(`Could not find propertie ${variable_header_list[0]} in search scope ${search_scope_string}.`);
        }
    }

    content_to_html(tags_list, tag_type){

        let self = this;
        if(tag_type == 'variable'){
            tags_list.forEach((tag)=>{
                this.new_html = this.new_html.replaceAll(tag.element, tag.content);
            });
        } else if (tag_type == 'function'){
            console.log('Function tags list', tags_list)
            tags_list.forEach((tag)=>{
                if (!tag.is_child){
                    this.new_html = this.new_html.replaceAll(tag.full_original_html, tag.content.full);
                }
            });
        }
    }
}

class VariableTag extends CustomTag {
    constructor(...props){
        super(...props);

        this.content = '';
    }
}

class FunctionTag extends CustomTag {
    constructor(...props){
        super(...props);

        this.function_type = '';
        this.tag_type = '';

        this.index_number = 0;
    }
}

class FunctionOpenTag extends FunctionTag {
    constructor(...props){
        super(...props);

        this.content = {full: '',
                        list: [],
                        };

        this.header = {...super.header,
                        dict: {function_type: '',
                            }
                        }

        this.full_original_html = '';
        
        this.is_opentag = true;
        this.endtag = null; // The object or objects being passed must be stored in an array.

        this.internal_html = {original: '',
                            with_content_list: [],
                            };

        this.internal_variables_list = [];

        this.is_parent = false;
        this.is_child = false;

        this.child_tags = [];
        this.parent_tag = null; // The object or objects being passed must be stored in an array.
    }
}

class FunctionForTag extends FunctionOpenTag {
    constructor(...props){
        super(...props)

        this.header = {...super.header,
            dict: {function_type: '',
                variable: '',
                operator: '',
                iterable_variable: '',
                iterable_variable_list: []
                }
            }
    }

    /**
     * @param {object} tag 
     * @returns {object}
     */
    processing_for_function(tag){
        tag = this.get_internal_tag_markup(tag);

        if (tag.header.dict.operator == 'in'){
            tag = this.get_internal_variables(tag);
            tag = this.get_content_list(tag);
            tag = this.content_to_html_list(tag);
        } else {
            throw new HTMLCustomTagsError(`Unexpected operator's value. ${tag.element} recieved "${tag.header.dict.operator}" instead of "in"`)
        }
        return tag;
    }

    get_internal_tag_markup(tag){
        tag.header.dict.variable = tag.header.list[1];
        tag.header.dict.operator = tag.header.list[2];
        tag.header.dict.iterable_variable = tag.header.list[3];
        tag.header.dict.iterable_variable_list = tag.header.list[3].split('.');

        return tag;
    }

    get_internal_variables(tag){
        tag.internal_variables_list = this.get_html_tags_list('inner_variable', tag);
        return tag;
    }

    get_content_list(tag){
        if(!tag.is_child){
            tag.content.list = this.get_tag_content(tag.header.dict.iterable_variable_list);
        } else if (tag.is_child) {
            tag.parent_tag[0].content.list.forEach((parent_object)=>{
                tag.content.list.push(this.get_tag_content([tag.header.dict.iterable_variable_list[1]], parent_object));
            });
        } else {
            throw new HTMLCustomTagsError(`Unable to establish parent or child tag affiliation. ${tag.element}`);
        }
        return tag;
    }

    content_to_html_list(tag){
        let self = this;
        let content_list = tag.content.list.map((object)=>{return object});
        function object_to_html(object){
            let html_with_content = tag.internal_html.original;

            tag.internal_variables_list.forEach((internal_variable)=>{
                let content = self.get_tag_content([internal_variable.header.list[1]], object)
                html_with_content = html_with_content.replaceAll(internal_variable.element, content)
            });
            return html_with_content;
        }

        let recursion_on;
        function recursion(content_list){
            let html_with_content = '';
            
            content_list.forEach((object)=>{
                if(Array.isArray(object)){
                    recursion_on = true;
                    recursion(object);
                } else {
                    if (recursion_on){
                        html_with_content += object_to_html(object);
                    } else {
                        tag.internal_html.with_content_list.push(object_to_html(object));
                    }
                }
            });

            recursion_on && tag.internal_html.with_content_list.push(html_with_content);
            recursion_on = false
        }
        recursion(content_list);
        return tag;
    }
}

class FunctionIfTag extends FunctionOpenTag {
    constructor(...props){
        super(...props)

        this.operators = ['==', '!=', 'in']

        this.header = {...super.header,
                        dict: {function_type: '',
                            variable_1: null,
                            variable_2: null,
                            iterable_variable: '',
                            iterable_variable_list: []
                            }
                        }

        this.is_else = false;
        this.elsetag = null;

        this.true_module = '';
        this.else_module = '';
    }

    /**
     * @param {object} tag 
     * @returns {object}
     */
    processing_if_function(tag){
        tag = this.get_internal_tag_markup(tag);
        tag = this.condition_check(tag);
        return tag;
    }

    get_internal_tag_markup(tag){
        let self = this;
        tag.header.dict.variable_1 = tag.header.list[1];
        tag.header.dict.variable_1_list = this.variable_to_list(tag.header.dict.variable_1.replace('!', ''));

        function variable_definition(variable_list){
            let variable_value;
            if (variable_list[0] in window){
                variable_value = self.get_tag_content(variable_list);
            } else if (variable_list[0] == 'null' || variable_list[0] == 'undefined'){
                variable_value = `${variable_list[0]}`;
            } else {
                throw new HTMLCustomTagsError(`Variable "${variable_list.join('.')}" does not exist or is not in the global scope.`)
            }
            return variable_value;
        }

        tag.header.dict.variable_1_value = variable_definition(tag.header.dict.variable_1_list);

        if (tag.header.list.length > 2){
            tag.header.dict.operator = tag.header.list[2];
            tag.header.dict.variable_2 = tag.header.list[3];
            tag.header.dict.variable_2_list = this.variable_to_list(tag.header.dict.variable_2.replace('!', ''));

            this.operator_is_valid(tag);

            tag.header.dict.variable_2_value = variable_definition(tag.header.dict.variable_2_list);
        }

        // if (tag.is_child){

        //     if(tag.parent_tag[0].function_type== 'for'){

        //         if (tag.header.dict.variable_1_list[0] == tag.parent_tag[0].header.dict.variable){
        //             console.log('There is a match for variable 1')
        //             console.log(tag.get_tag_content([tag.parent_tag[0].header.dict.variable], tag.parent_tag[0].content.list))
        //         }

        //         if (tag.header.dict.variable_2_list[0] == tag.parent_tag[0].header.dict.variable){
        //             console.log('There is a match for variable 2')
        //             console.log(tag.get_tag_content([tag.parent_tag[0].header.dict.variable], tag.parent_tag[0].content.list[0]))
        //         }

        //     }
        // }

        return tag;
    }

    /**
     * @param {*} operator 
     */
    operator_is_valid(tag){
        if(this.operators.includes(tag.header.dict.operator)){
            return true;
        } else {
            throw new HTMLCustomTagsError(`Operator is invalid. Expected "==" or "!=" or "in", but got "${tag.header.dict.operator}"`);
        }
    }

    condition_check(tag){
        if (tag.header.dict.variable_2 !== undefined && tag.header.dict.variable_2 != null){
            
            switch (tag.header.dict.operator){
                case '==':
                    if(tag.header.dict.variable_1_value == tag.header.dict.variable_2_value){
                        return this.condition_true(tag);
                    } else {
                        return this.condtition_false(tag);
                    }
                case '!=':
                    if(tag.header.dict.variable_1_value != tag.header.dict.variable_2_value){
                        return this.condition_true(tag);
                    } else {
                        return this.condtition_false(tag);
                    }
            }
        } else {

            if (tag.header.dict.variable_1_value && tag.header.dict.variable_1.indexOf('!') != 0){
                return this.condition_true(tag);
            } else if (tag.header.dict.variable_1_value && tag.header.dict.variable_1.indexOf('!') == 0){
                return this.condtition_false(tag);
            } else if (tag.header.dict.variable_1_value == null || tag.header.dict.variable_1_value === undefined) {
                return this.condtition_false(tag);
            }
            return tag;
        }
    }

    condition_true(tag){
        if (tag.elsetag){
            tag.true_module = this.html.slice(tag.ending_tag_index, tag.elsetag[0].beginning_tag_index);
            tag.content.full = tag.true_module;
        } else {
            tag.content.full = tag.internal_html.original;
        }
        return tag;
    }

    condtition_false(tag){
        if (tag.elsetag){
            tag.false_module = this.html.slice(tag.elsetag[0].ending_tag_index, tag.endtag[0].beginning_tag_index);
            tag.content.full = tag.false_module;
        }
        return tag;
    }
}

class FunctionElseTag extends FunctionTag {
    constructor(...props){
        super(...props);

        this.is_else = true;
        this.if_tag = [];
    }

    static check_else_tag(tag){
        return new RegExp(`\\[%\\s*else\\s*%\\]`).test(tag.element);
    }
}

class FunctionEndTag extends FunctionTag {
    constructor(...props){
        super(...props);
        
        this.is_endtag = true;
        this.opentag = [];
    }

    static check_for_endtag(tag){
        return new RegExp(`\\[%\\s*end[a-z]+\\s*%\\]`).test(tag.element);
    }
}

class CustomVariableTag extends CustomTag{
    constructor(...props){
        super(...props);
    }

    async get_html_tags_variable(){
        let self = this;
        return new Promise((resolve, reject)=>{
            let tags_list = self.get_html_tags_list('variable');

            tags_list.forEach((tag, ind)=>{
                try{
                    this.variable_is_valid(tag);
                    tag.content = self.get_tag_content(tag.header.list);
                } catch (error) {
                    tag.content = '';
                    console.warn('The tag that caused the error', tag);
                    console.error(error);
                } finally {
                    tags_list[ind] = tag;
                }
            })

            this.tags_list['variables'] = tags_list;
            this.content_to_html(tags_list, 'variable');
            resolve();
        });
    }

    variable_is_valid(tag){
        if (!this.variable_is_global(tag) && tag.type == 'variable'){
            throw new HTMLCustomTagsError(`Variable "${tag.element_text}" does not exist or is not in the global scope.`)
        } else {
            return;
        }
    }
}

class CustomFunctionTag extends CustomVariableTag{
    constructor(...props){
        super(...props)
    }

    async get_html_tags_function(){
        let self = this;
        return new Promise((resolve, reject)=>{
            let tags_list = this.get_html_tags_list('function');
            let tags_list_copy = [];
            tags_list.forEach((tag, ind)=>{
                try{
                    if(tag.is_opentag){
                        tag = this.standart_functions(tag);
                    }
                } catch (error){
                    if (tag.is_opentag){
                        tag.content.full = '';
                    }
                    console.warn('The tag that caused the error', tag);
                    console.error(error);
                } finally {
                    tags_list[ind] = tag;
                }

            });

            tags_list = this.set_tag_dependencies(tags_list);

            tags_list.forEach((tag)=>{
                if (tag.is_opentag){
                    try {
                        tag = this.get_function_tag_code(tag);
                        tag = this.processing_function(tag);
                    } catch (error){
                        if (tag.is_opentag){
                            tag.content.full = null;
                        }
                        console.warn('The tag that caused the error', tag);
                        console.error(error);
                    } finally {
                        tags_list_copy.push(tag);
                    }
                }
            });

            tags_list = tags_list_copy;
            tags_list = this.child_content_to_parent(tags_list);
            this.content_to_html(tags_list, 'function');

            this.tags_list['functions'] = this.processed_function_tags;
            resolve()
        })
    }

    set_tag_dependencies(tags_list){
        for (let ind=0; ind < tags_list.length; ind++){
            let tag = tags_list[ind];
            let open_tags_count = 0;
            let close_tags_count = 0;
            
            if (tag.is_opentag){
                open_tags_count++;

                let i = ind;
                function recursion(){

                    if (open_tags_count != close_tags_count && tags_list[i+1] === undefined){
                        throw new HTMLCustomTagsError(`No closing tag found for ${tag.element}. Did you forget to put the [% end${tag.function_type} %] closing tag?`)
                    }

                    if (tag.is_else){
                        i++;
                        return recursion();
                    }

                    if (tags_list[i+1].is_endtag){

                        close_tags_count++;
                        if (open_tags_count == close_tags_count){
                            tag.endtag = [tags_list[i+1]];
                            tags_list[i+1].opentag = [tag];
                            
                            return;
                        } else {
                            i++;
                            return recursion();
                        }
                    } else if (tags_list[i+1].is_opentag){
                        tag.is_parent = true;
                        tag.child_tags.push(tags_list[i+1]);
                        
                        tags_list[i+1].is_child = true;
                        tags_list[i+1].parent_tag = [tag];
                        
                        i++;
                        open_tags_count++;
                        return recursion();
                    }
                    i++;
                    return recursion();
                }
                recursion();
            } else if (tag.is_endtag){
                close_tags_count++;
            } else if (tag.is_else){
                tag.if_tag = [tags_list[ind-1]];
                tag.if_tag[0].elsetag = [tag];
            } else {
                throw new HTMLCustomTagsError(`Unknown tag type`)
            }
        }
        return tags_list;
    }

    get_function_tag_code(tag, source_html=null){
        let self = this;

        if (!tag.is_opentag){
            return;
        }

        let html = this.html;
        if(source_html != null){
            html = source_html;
        }
        
        tag.full_original_html = this.html.slice(tag.beginning_tag_index, tag.endtag[0].ending_tag_index);
        tag.internal_html.original = this.html.slice(tag.ending_tag_index, tag.endtag[0].beginning_tag_index);

        if (tag.endtag[0] === null){
            throw new HTMLCustomTagsError(`No closing tag found for ${tag.tag_element}. Did you forget to use the [% end${tag.function_type} %]?`);
        }
        
        this.invalid_functions_tags.push(tag);

        return tag;   
    }

    /**
     * @param {object} tag 
     * @returns {object}
     */
    standart_functions(tag){
        tag.header.dict.function_type = tag.header.list[0];
        tag.function_type = tag.header.list[0];

        if (tag.function_type == 'for'){
            tag = new FunctionForTag().get_properties(tag);
        } else if (tag.function_type == 'if'){
            tag = new FunctionIfTag().get_properties(tag);
        } else {
            throw new HTMLCustomTagsError('Unsuported function type: ', tag.function_type)
        }
        return tag;
    }

    processing_function(tag){
        if (tag.function_type == 'for'){
            tag = tag.processing_for_function(tag);
        } else if (tag.function_type == 'if'){
            tag = tag.processing_if_function(tag);
        } else {
            throw new HTMLCustomTagsError('Unsuported function type: ', tag.function_type)
        }
        return tag;
    }

    child_content_to_parent(tags_list){
        let self = this;

        function get_tag_from_list(tags_list){
            tags_list.forEach((tag, ind)=>{
                try{
                    tag = (tag.is_parent) ? get_parent_content_object(tag, tag.child_tags) : self.html_to_full_string(tag);
                    tags_list[ind] = tag;
                } catch (error){
                    tag.content.full = '';
                    console.warn('The tag that caused the error', tag);
                }
            });
            return tags_list;
        }

        function get_parent_content_object(tag, child_tags){
            tag.internal_html.with_content_list.forEach((parent_object_html, ind)=>{
                tag.content.full += get_child_content(parent_object_html, child_tags, ind)
            });
            return tag;
        }

        function get_child_content(parent_html, child_tags, parent_obj_ind){
            child_tags.forEach((child_tag, ind)=>{
                
                if (child_tag.is_parent){
                    child_tag.child_tags = get_tag_from_list(child_tag.child_tags);
                    child_tags[ind] = child_tag;
                }

                parent_html = parent_html.replace(child_tag.full_original_html, child_tag.internal_html.with_content_list[parent_obj_ind]);
            });
            return parent_html;
        }
        tags_list = get_tag_from_list(tags_list);
        return tags_list;
    }

    html_to_full_string(tag){
        if (tag.function_type == 'for'){
            if (tag.internal_html.with_content_list.length > 0){
                tag.internal_html.with_content_list.forEach((html_with_content)=>{
                    tag.content.full += html_with_content;
                });
            } else {
                throw new HTMLCustomTagsError(`Failed to build html for ${tag.element}. Content list is empty`);
            }
        }
        return tag;
    }
}

class ObjectToHTML extends CustomFunctionTag{
    constructor(properties, ...props){
        super(...props);

        this.api_requests = properties.api_requests;

        this.tag_object_name = '';
        // this.elements_to_update = null;

        this.api_requests();
    }

    /**
     * @param {stirng} tag_object_name 
     * @param {list | null} elements_to_update 
     */
    async init_method(tag_object_name='', elements_to_update=null){
        this.tag_object_name = tag_object_name;

        if (elements_to_update && this.html != '' && (window.location.href == window.location.origin  || window.location.href == `${window.location.origin}/`)){
            console.log('case 1')
            elements_to_update = null;
            await this.get_original_html();
        } else if (elements_to_update && this.html != '' && window.location.href != window.location.origin){
            // pass
            console.log('case 2')
            // elements_to_update = null;
            // await this.get_original_html();
        } else if ((elements_to_update && this.html == '') || !elements_to_update){
            console.log('case 3')
            await this.get_original_html();
        } else {
            console.log('case 4')
            elements_to_update = null;
            await this.get_original_html();
        }
        await this.tag_processing(elements_to_update);
    }

    async get_original_html(){
        console.log('Начинаю запрос оригинального html')
        return new Promise((resolve, reject)=>{
            $.ajax({
                url: window.location.href,
                method: 'GET',
                async: true,
                success: (response)=>{
                    if (typeof(response) === 'string'){
                        this.html = response;
                        this.new_html = response;
                    } else if (Object.prototype.toString.call(response) === '[object Object]'){
                        window[this.tag_object_name] = response;
                    }
                    resolve();
                },
                error: (xhr, errro, status)=>{
                    reject();
                }
            });
        });
    }

    async html_cleaning(){
        new Promise((resolve, reject)=>{
            this.new_html = this.new_html.replaceAll('undefined', '');
            resolve()
        })
    }

    get_scripts(){
        let scripts = Object.entries(document.querySelectorAll('body script'));
        scripts.forEach(([ind, script])=>{
            try{
                if (script.src != ''){
                    fetch(script.src)
                        .then((response)=>{return response.text()})
                            .then((response)=>{
                                try{
                                    let code = response.replaceAll(`= new ${this.constructor.name}()`, '');
                                    let func = new Function(response);
                                    func();
                                } catch (error){
                                    console.error(error);
                                }
                            });
                } else {
                    let code = script.innerText.replaceAll(`= new ${this.constructor.name}()`, '');
                    let func = new Function(code);
                    try {
                        func();
                    } catch (error){
                        console.error(error)
                    }
                }
            } catch (error) {
                console.error(error)
            }
        })
    }

    // getCurrentScriptFileName() {
    //     try {
    //         throw new Error();
    //     } catch (e) {
    //         const stackLines = e.stack.split('\n');
    //         const callerStackLine = stackLines[2];
    //         const matches = callerStackLine.match(/(?:https?|file):\/\/.*?([^\/]+\.js)/);
            
    //         if (matches) {
    //             console.log('Имя скрипта', matches[1])
    //             return matches[1];
    //         }
    //     }
    //     return null;
    // }
    
    // async html_cleaning(){
    //     console.log('Запуск процесса очистки тегов')
    //     let variables_tags = this.get_html_tags_list('variable', null, true);
    //     let functions_tags = this.get_html_tags_list('function');
    //     console.log(variables_tags, functions_tags)
    //     functions_tags = this.set_tag_dependencies(functions_tags);
    //     // console.log(variables_tags, functions_tags)
    //     try {
    //         for (let i=0; i<functions_tags.length; i++){
    //             let tag = functions_tags[i];
    //             tag = this.get_function_tag_code(tag);
    
    //             if (tag.is_endtag){
    //                 functions_tags.splice(i, 1);
    //                 i--;
    //                 continue;
    //             }
                
    //             tag.content.full = '';
    //         }
    
    //         for (let i=0; i<variables_tags.length; i++){
    //             variables_tags[i].content = '';
    //         }
    //         // console.log(variables_tags, functions_tags)
    //     } catch (error) {
    //         console.error(error);
    //     } finally {
    //         this.content_to_html(functions_tags, 'function');
    //         this.content_to_html(variables_tags, 'variable');
    //         console.log('Процесс очистки тегов закончен')
    //     }
    // }

     /**
     * @ A method that starts the process of processing variable tags and function tags, and substituting objects that correspond to them.
     * @ The launch is carried out by running the:
     * @ get_html_tags_variable() 
     * @ and 
     * @ get_html_tags_function() 
     * @ methods.
     */
    async tag_processing(elements_to_update=null){
        try{
            this.new_html = this.html;
            await this.get_html_tags_function();
            await this.get_html_tags_variable();
        } catch (error){
            console.error(error);
        } finally {
            await this.html_cleaning();
            this.render_html(elements_to_update);
            this.hang_event_handlers();
            this.get_scripts();
        }
    }

    render_html(elements_to_update=null){
        if (!elements_to_update){
            document.getElementsByTagName('html')[0].innerHTML = this.new_html;
        } else {
            let temp_new_html = document.createElement('div');
            temp_new_html.innerHTML = this.new_html
            elements_to_update.forEach((element_selector, ind)=>{
                let new_element = temp_new_html.querySelector(element_selector);
                let original_element = document.querySelector(element_selector);

                original_element.innerHTML = new_element.innerHTML;
            })
        }
    }

    hang_event_handlers(){
        let self = this;
        let links = Object.entries(document.getElementsByTagName('a'));

        links.forEach(([ind, link])=>{
            link.addEventListener('click', (event)=>{self.get_html_request(event, link.href)});
        })
    }

    get_html_request(event, url){
        console.log('Ссылка нажата')
        event.preventDefault();
        history.pushState({page: 'new_page'}, null, url)
        this.api_requests();
    }
}

class DetailViewAPIRequest {
    constructor(props){
        this.api_url = props.api_url;
        this.success = props.success;

        this.object;

        // this.html = document.getElementsByTagName('html')[0].innerHTML;
    }
    
    async get_object(data_type=null) {
        let self = this;

        return new Promise((resolve, reject)=>{
            $.ajax({
                url: self.api_url,
                method: 'GET',
                dataType: 'json',
                async: true,
                success: (response)=>{
                    try{
                        $.each(response, (key, value)=>{
                            self[key] = value;
                        });
                        self.success(response);
                        resolve(response);
                    } catch (error){
                        console.error(error);
                    }
                },
                error: (xhr, error, status)=>{
                    console.error(`Error: ${error}, Status: ${xhr.status}, ${status}`)
                    reject();
                }
            })
        })
    }
}

class UpdateViewAPIRequest extends DetailViewAPIRequest {
    constructor(props){
        super(props);
    }
}

class ListViewAPIRequest extends DetailViewAPIRequest {
    constructor(props){
        super(props);

        // this.get_object_list();
    }

    async get_object_list(){
        return await super.get_object();
    };
}

class RelatedFieldAPIRequest extends ListViewAPIRequest {
    /**
     * @param {dict} props
     * @param {list} props.related_api_urls list
     */
    constructor(props){
        this.related_api_urls = props.related_api_urls;
        this.form = props.form;

        this.method = props.method;

        this.post_api_url = props.post_api_url;
        this.update_api_url = props.update_api_url;

        this.response_data = {};

        this.option_tag = props.option_tag;
        this.success_request = props.success_request;

        this.__get_related_fields_data__();
        this.__send_post_api__();
    };

    /** 
     * @param {str} api_url
     * @param {str} data_key
     */

    async __get_related_fields_data__(){
        if (Object.prototype.toString.call(this.related_api_urls) === '[object Object]'){
            for (let field in this.related_api_urls){
                let url = this.related_api_urls[field];
                await this.__get_object_list__(field, url);
            }
            this.__fill_form_related_fields__();
            return this.response_data;
        } else {
            throw new HTMLCustomTagsError(`${this.constructor.name}.related_api_urls must contain dict, not "${this.related_api_urls}"`);
        };
    };

    __fill_form_related_fields__(){

        let html_string = '';

        $.each(this.response_data, (field, value)=>{
            
            let rel_field = this.form.find(`[name=${field}]`);
            rel_field.html('');
            
            html_string = '';
            
            $.each(value, (ind, obj)=>{
                html_string += this.option_tag(obj)[field];
            });

            rel_field.html(html_string);
        });
    };

    __send_post_api__(){
        
        let self = this;

        this.form.on('submit', function (e){
            e.preventDefault();
    
            let form_data = {};
            let inputs = self.form.find('input');
            let selects = self.form.find('select');
    
            $.each(inputs, (ind, input)=>{
                form_data[input.name] = input.value;
            });
    
            $.each(selects, (ind, select)=>{
    
                let selected_optns = [];
    
                $.each(select.selectedOptions, (ind, selected_option)=>{
                    let select_dict = {};
                    select_dict['id'] = selected_option.value;
                    select_dict[selected_option.getAttribute('name')] = selected_option.innerText;
                    selected_optns.push(select_dict);
                });
    
                form_data[select.name] = selected_optns;
            });
    
            form_data = JSON.stringify(form_data);

            $.ajax({
                url: self.post_api_url,
                method: self.method,
                contentType: 'application/json',
                data: form_data,
                success: function(response){
                    self.success_request(response);
                },
                error: (xhr, status, error)=>{
                    console.error(`AJAX error: ${xhr}, ${status}, ${error}`);
                },
            })
        })
    }
};