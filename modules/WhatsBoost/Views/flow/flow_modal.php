<?php echo form_open(get_uri("whatsboost/save_flow"), array("id" => "prompt-form", "class" => "prompt-form", "role" => "form"), ['id' => $model_info['id'] ?? '']); ?>
<div class="modal-body clearfix">
    <div class="container-fluid">
        <div class="form-group">
            <div class="row mt-3">
                <label for="flow_name" class="form-label"><span class="text-danger mr5">*</span><?php echo app_lang('flow_name'); ?></label>
                <div class="col-md-12">
                    <?php
                    echo form_input(array(
                        "id" => "flow_name",
                        "name" => "flow_name",
                        "value" => $model_info['name'] ?? '',
                        "class" => "form-control validate-hidden",
                        "placeholder" => app_lang('name'),
                        "autofocus" => true,
                        "data-rule-required" => true,
                        "data-msg-required" => app_lang("field_required"),
                    ));
                    ?>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal-footer">
    <button type="button" class="btn btn-default" data-bs-dismiss="modal"><span data-feather="x" class="icon-16"></span> <?php echo app_lang('close'); ?></button>
    <button type="submit" class="btn btn-primary"><span data-feather="check-circle" class="icon-16"></span> <?php echo app_lang('save'); ?></button>
</div>
<?php echo form_close(); ?>

<script type="text/javascript">
    $(document).ready(function() {
        window.projectForm = $("#prompt-form").appForm({
            closeModalOnSuccess: false,
            onSuccess: function(response) {
                if (response.type == 'success') {
                    appAlert.success(response.message, {
                        duration: 10000
                    });
                } else {
                    appAlert.error(response.message, {
                        duration: 10000
                    });
                }
                window.projectForm.closeModal();
                setTimeout(() => {
                    location.reload();
                }, 1000);
            }
        });
    });
</script>
